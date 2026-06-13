import { createAPIFileRoute } from "@tanstack/react-start/api";
import { db } from "@/lib/db";
import { runMigrations } from "@/lib/migrate";
import { getOrCreateProfile } from "@/lib/server-auth";

const SESSION_DAYS = 30;

export const APIRoute = createAPIFileRoute("/api/auth/callback")({
  GET: async ({ request }) => {
    const url = new URL(request.url);
    const code = url.searchParams.get("code");
    const error = url.searchParams.get("error");

    if (error || !code) {
      return new Response(null, { status: 302, headers: { Location: "/?auth_error=1" } });
    }

    try {
      await runMigrations();

      const origin = url.origin;

      // Exchange code for tokens
      const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          code,
          client_id: process.env.GOOGLE_CLIENT_ID!,
          client_secret: process.env.GOOGLE_CLIENT_SECRET!,
          redirect_uri: `${origin}/api/auth/callback`,
          grant_type: "authorization_code",
        }),
      });

      if (!tokenRes.ok) {
        console.error("[auth/callback] token exchange failed:", await tokenRes.text());
        return new Response(null, { status: 302, headers: { Location: "/?auth_error=2" } });
      }

      const tokens = await tokenRes.json() as { access_token: string };

      // Get user info from Google
      const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const userInfo = await userRes.json() as { email: string; name?: string };

      if (!userInfo.email) {
        return new Response(null, { status: 302, headers: { Location: "/?auth_error=3" } });
      }

      // Create or find profile (assigns super_admin to first user)
      const profile = await getOrCreateProfile(userInfo.email);
      if (userInfo.name) {
        await db`UPDATE profiles SET full_name = ${userInfo.name} WHERE id = ${profile.id}`;
      }

      // Create session
      const [session] = await db<[{ id: string }]>`
        INSERT INTO sessions (user_id, expires_at)
        VALUES (${profile.id}, NOW() + INTERVAL '${db.unsafe(String(SESSION_DAYS))} days')
        RETURNING id
      `;

      const maxAge = SESSION_DAYS * 24 * 3600;
      const cookie = [
        `smartpath_session=${session.id}`,
        "Path=/",
        "HttpOnly",
        "SameSite=Lax",
        `Max-Age=${maxAge}`,
        // Only set Secure when actually on HTTPS
        url.protocol === "https:" ? "Secure" : "",
      ].filter(Boolean).join("; ");

      return new Response(null, {
        status: 302,
        headers: {
          Location: "/app/dashboard",
          "Set-Cookie": cookie,
        },
      });
    } catch (e) {
      console.error("[auth/callback] error:", e);
      return new Response(null, { status: 302, headers: { Location: "/?auth_error=5" } });
    }
  },
});

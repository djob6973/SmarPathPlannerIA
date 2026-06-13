import { defineEventHandler, getHeader, getQuery, sendRedirect, setCookie } from "h3";
import { db } from "@/lib/db";
import { runMigrations } from "@/lib/migrate";
import { getOrCreateProfile } from "@/lib/server-auth";

const SESSION_DAYS = 30;

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const code = query.code as string | undefined;
  const error = query.error;

  if (error || !code) return sendRedirect(event, "/?auth_error=1", 302);

  try {
    await runMigrations();

    const host = getHeader(event, "host") ?? "";
    const proto = getHeader(event, "x-forwarded-proto") ?? "https";
    const origin = `${proto}://${host}`;

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
      return sendRedirect(event, "/?auth_error=2", 302);
    }

    const tokens = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = (await userRes.json()) as { email: string; name?: string };

    if (!userInfo.email) return sendRedirect(event, "/?auth_error=3", 302);

    const profile = await getOrCreateProfile(userInfo.email);
    if (userInfo.name) {
      await db`UPDATE profiles SET full_name = ${userInfo.name} WHERE id = ${profile.id}`;
    }

    const [session] = await db<[{ id: string }]>`
      INSERT INTO sessions (user_id, expires_at)
      VALUES (${profile.id}, NOW() + (${SESSION_DAYS} * INTERVAL '1 day'))
      RETURNING id
    `;

    setCookie(event, "smartpath_session", session.id, {
      httpOnly: true,
      path: "/",
      maxAge: SESSION_DAYS * 24 * 3600,
      sameSite: "lax",
      secure: proto === "https",
    });

    return sendRedirect(event, "/app/dashboard", 302);
  } catch (e) {
    console.error("[auth/callback] error:", e);
    return sendRedirect(event, "/?auth_error=5", 302);
  }
});

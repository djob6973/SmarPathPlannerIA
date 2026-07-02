// In-app Google OAuth 2.0 — added alongside the existing email/password login.
// Not the platform oauth2-proxy: that perimeter only guards the Dokku dashboard,
// not individual apps (confirmed while building this), so identity has to be
// resolved inside the app itself, same as the password flow.
import { db } from "./db";
import { runMigrations } from "./migrate";
import { getOrCreateProfile } from "./server-auth";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const SESSION_DAYS = 30;

function getOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") ?? url.protocol.replace(":", "");
  const host = request.headers.get("host") ?? url.host;
  return `${proto}://${host}`;
}

export async function handleGoogleSignin(request: Request): Promise<Response> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return new Response("Google OAuth no está configurado", { status: 500 });

  const origin = getOrigin(request);
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  return new Response(null, {
    status: 302,
    headers: { Location: `${GOOGLE_AUTH_URL}?${params}` },
  });
}

export async function handleGoogleCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error || !code) {
    return new Response(null, { status: 302, headers: { Location: "/login?auth_error=1" } });
  }

  try {
    await runMigrations();

    const origin = getOrigin(request);

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: `${origin}/api/auth/google/callback`,
        grant_type: "authorization_code",
      }),
    });

    if (!tokenRes.ok) {
      console.error("[auth/google/callback] token exchange failed:", await tokenRes.text());
      return new Response(null, { status: 302, headers: { Location: "/login?auth_error=2" } });
    }

    const tokens = (await tokenRes.json()) as { access_token: string };

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = (await userRes.json()) as { email: string; name?: string };

    if (!userInfo.email) {
      return new Response(null, { status: 302, headers: { Location: "/login?auth_error=3" } });
    }

    const email = userInfo.email.toLowerCase().trim();
    const profile = await getOrCreateProfile(email);
    if (userInfo.name && !profile.full_name) {
      await db`UPDATE profiles SET full_name = ${userInfo.name} WHERE id = ${profile.id}`;
    }

    const [session] = await db<[{ id: string }]>`
      INSERT INTO sessions (user_id, expires_at)
      VALUES (${profile.id}, NOW() + (${SESSION_DAYS} * INTERVAL '1 day'))
      RETURNING id
    `;

    const isHttps = origin.startsWith("https:");
    const maxAge = SESSION_DAYS * 24 * 3600;
    const cookie = [
      `smartpath_session=${session.id}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${maxAge}`,
      isHttps ? "Secure" : "",
    ]
      .filter(Boolean)
      .join("; ");

    return new Response(null, {
      status: 302,
      headers: { Location: "/app/dashboard", "Set-Cookie": cookie },
    });
  } catch (e) {
    console.error("[auth/google/callback] error:", e);
    return new Response(null, { status: 302, headers: { Location: "/login?auth_error=5" } });
  }
}

import { createError, defineEventHandler, getHeader, sendRedirect } from "h3";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export default defineEventHandler(async (event) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) throw createError({ statusCode: 500, message: "OAuth not configured" });

  const host = getHeader(event, "host") ?? "localhost";
  const proto = getHeader(event, "x-forwarded-proto") ?? "http";
  const origin = `${proto}://${host}`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/callback`,
    response_type: "code",
    scope: "openid email profile",
    access_type: "offline",
    prompt: "select_account",
  });

  return sendRedirect(event, `${GOOGLE_AUTH_URL}?${params}`, 302);
});

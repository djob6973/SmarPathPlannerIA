import { createAPIFileRoute } from "@tanstack/react-start/api";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

export const APIRoute = createAPIFileRoute("/api/auth/signin")({
  GET: async ({ request }) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return new Response("GOOGLE_CLIENT_ID not configured", { status: 500 });
    }

    const origin = new URL(request.url).origin;
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${origin}/api/auth/callback`,
      response_type: "code",
      scope: "openid email profile",
      access_type: "offline",
      prompt: "select_account",
    });

    return new Response(null, {
      status: 302,
      headers: { Location: `${GOOGLE_AUTH_URL}?${params}` },
    });
  },
});

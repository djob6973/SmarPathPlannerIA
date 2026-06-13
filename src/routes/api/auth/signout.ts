import { createAPIFileRoute } from "@tanstack/react-start/api";
import { db } from "@/lib/db";

export const APIRoute = createAPIFileRoute("/api/auth/signout")({
  GET: async ({ request }) => {
    const cookies = request.headers.get("cookie") ?? "";
    const match = cookies.match(/smartpath_session=([^;]+)/);
    if (match) {
      const sessionId = decodeURIComponent(match[1]);
      await db`DELETE FROM sessions WHERE id = ${sessionId}`.catch(() => {});
    }

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": "smartpath_session=; Path=/; HttpOnly; Max-Age=0",
      },
    });
  },
});

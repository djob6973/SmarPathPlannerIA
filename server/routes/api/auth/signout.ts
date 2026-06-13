import { defineEventHandler, getCookie, sendRedirect, setCookie } from "h3";
import { db } from "@/lib/db";

export default defineEventHandler(async (event) => {
  const sessionId = getCookie(event, "smartpath_session");
  if (sessionId) {
    await db`DELETE FROM sessions WHERE id = ${sessionId}`.catch(() => {});
  }

  setCookie(event, "smartpath_session", "", { httpOnly: true, path: "/", maxAge: 0 });

  return sendRedirect(event, "/", 302);
});

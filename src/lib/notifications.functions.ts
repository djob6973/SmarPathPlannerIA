import { createServerFn } from "@tanstack/react-start";
import { getAuthContext } from "./server-auth";

export type NotificationRow = {
  id: string; type: string; title: string; body: string | null;
  data: Record<string, unknown>; read: boolean; created_at: string;
};

export const getNotifications = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getAuthContext();
  if ("error" in auth) throw new Error(auth.error);
  const { db, userId } = auth;

  const rows = await db<NotificationRow[]>`
    SELECT id, type, title, body, data, read, created_at
    FROM notifications
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 50
  `;
  return { notifications: rows };
});

export const markAllNotificationsRead = createServerFn({ method: "POST" }).handler(async () => {
  const auth = await getAuthContext();
  if ("error" in auth) throw new Error(auth.error);
  const { db, userId } = auth;

  await db`
    UPDATE notifications SET read = true
    WHERE user_id = ${userId} AND read = false
  `;
  return { ok: true };
});

export const markNotificationRead = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId } = auth;

    await db`
      UPDATE notifications SET read = true
      WHERE id = ${data.id} AND user_id = ${userId}
    `;
    return { ok: true };
  });

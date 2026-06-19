import { createServerFn } from "@tanstack/react-start";
import { getAuthContext } from "./server-auth";
import type { db as DbType } from "./db";

// Internal helper — called from other server handlers to fan-out notifications.
// Receives `db` as a parameter to avoid importing postgres at module level
// (which would leak the Node.js-only package into the client bundle).
export async function insertNotification(
  db: typeof DbType,
  recipientId: string,
  type: string,
  title: string,
  body: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  try {
    await db`
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (${recipientId}, ${type}, ${title}, ${body}, ${JSON.stringify(data)}::jsonb)
    `;
  } catch (e) {
    console.error("[notifications] insertNotification error:", e);
  }
}

export type NotificationRow = {
  id: string; type: string; title: string; body: string | null;
  data: Record<string, string | number | boolean | null>; read: boolean; created_at: string;
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

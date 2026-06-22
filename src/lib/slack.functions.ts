import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuthContext } from "./server-auth";
import { getSlackConfigFromDb, postSlackMessage, postSlackTestMessage } from "./slack";

export const getSlackConfig = createServerFn({ method: "GET" })
  .handler(async () => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const config = await getSlackConfigFromDb();
    const hasToken = !!process.env.SLACK_BOT_TOKEN;
    return { config, hasToken };
  });

export const saveSlackConfig = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      enabled:     z.boolean(),
      auto_notify: z.boolean(),
      channel:     z.string(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);

    const admins = await auth.db<{ role: string }[]>`
      SELECT role FROM user_roles_smart_path
      WHERE user_id = ${auth.userId} AND role = 'super_admin'
      LIMIT 1
    `;
    if (!admins.length) throw new Error("Solo super administradores pueden modificar esta configuración");

    const upsert = (key: string, value: string) => auth.db`
      INSERT INTO platform_settings (key, value)
      VALUES (${key}, ${value})
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()
    `;

    await Promise.all([
      upsert("slack_enabled",     String(data.enabled)),
      upsert("slack_auto_notify", String(data.auto_notify)),
      upsert("slack_channel",     data.channel),
    ]);

    return { ok: true };
  });

export const sendSlackNotification = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      requestId:      z.string().uuid(),
      channel:        z.string().optional(),
      deliverableIds: z.string().uuid().array().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    await postSlackMessage(data.requestId, data.channel, data.deliverableIds);
    return { ok: true };
  });

export const testSlackConfig = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ channel: z.string().min(1) }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);

    const admins = await auth.db<{ role: string }[]>`
      SELECT role FROM user_roles_smart_path
      WHERE user_id = ${auth.userId} AND role = 'super_admin'
      LIMIT 1
    `;
    if (!admins.length) throw new Error("Sin permisos de super administrador");

    await postSlackTestMessage(data.channel);
    return { ok: true };
  });

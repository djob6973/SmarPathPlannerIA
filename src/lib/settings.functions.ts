import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuthContext } from "./server-auth";

export const getPlatformSetting = createServerFn({ method: "GET" })
  .inputValidator((input: { key: string }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const rows = await auth.db<{ value: string | null }[]>`
      SELECT value FROM platform_settings WHERE key = ${data.key}
    `;
    return { value: rows[0]?.value ?? null };
  });

export const setPlatformSetting = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      key:   z.string().min(1),
      value: z.string().nullable(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);

    const roles = await auth.db<{ role: string }[]>`
      SELECT role FROM user_roles_smart_path
      WHERE user_id = ${auth.userId} AND role = 'super_admin'
      LIMIT 1
    `;
    if (roles.length === 0) throw new Error("Solo super administradores pueden modificar la configuración de la plataforma");

    if (data.value === null) {
      await auth.db`DELETE FROM platform_settings WHERE key = ${data.key}`;
    } else {
      await auth.db`
        INSERT INTO platform_settings (key, value)
        VALUES (${data.key}, ${data.value})
        ON CONFLICT (key) DO UPDATE
          SET value = EXCLUDED.value, updated_at = now()
      `;
    }
    return { ok: true };
  });

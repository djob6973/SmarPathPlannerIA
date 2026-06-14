import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuthContext } from "./server-auth";
import { db } from "./db";
import { hashPassword, verifyPassword } from "./password";
import type { AppPermission, AppRole } from "./permissions.types";

export interface CurrentUser {
  id: string;
  email: string;
  fullName: string | null;
  areaId: string | null;
  areaName: string | null;
  roles: AppRole[];
  permissions: AppPermission[];
}

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async (): Promise<CurrentUser | null> => {
    const auth = await getAuthContext();
    if ("error" in auth) return null;

    const { userId, userProfile } = auth;

    const roleRows = await db<{ role: string }[]>`
      SELECT role FROM user_roles_smart_path WHERE user_id = ${userId}
    `;
    const roles = roleRows.map((r) => r.role as AppRole);

    let permissions: AppPermission[] = [];
    if (roles.length > 0) {
      const permRows = await db<{ permission: string }[]>`
        SELECT DISTINCT permission
        FROM role_permissions
        WHERE role = ANY(${roles})
          AND enabled = true
      `;
      permissions = permRows.map((p) => p.permission as AppPermission);
    }

    let areaName: string | null = null;
    if (userProfile.area_id) {
      const areaRows = await db<{ name: string }[]>`
        SELECT name FROM areas WHERE id = ${userProfile.area_id}
      `;
      areaName = areaRows[0]?.name ?? null;
    }

    return {
      id: userId,
      email: userProfile.email,
      fullName: userProfile.full_name,
      areaId: userProfile.area_id,
      areaName,
      roles,
      permissions,
    };
  }
);

export const updateOwnProfile = createServerFn({ method: "POST" })
  .inputValidator((input: { fullName?: string }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { userId } = auth;
    await db`
      UPDATE profiles
      SET full_name = ${data.fullName ?? null}
      WHERE id = ${userId}
    `;
    return { ok: true };
  });

export const changeOwnPassword = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(6) }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { userId } = auth;

    const rows = await db<[{ password_hash: string | null }]>`
      SELECT password_hash FROM profiles WHERE id = ${userId}
    `;
    if (!rows.length || !rows[0].password_hash) throw new Error("Sin contraseña configurada");

    if (!verifyPassword(data.currentPassword, rows[0].password_hash)) {
      throw new Error("La contraseña actual es incorrecta");
    }

    await db`UPDATE profiles SET password_hash = ${hashPassword(data.newPassword)} WHERE id = ${userId}`;
    return { ok: true };
  });

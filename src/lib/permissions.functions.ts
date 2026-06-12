import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuthContext } from "./server-auth";
import { db } from "./db";
import type { AppPermission, AppRole } from "./permissions.types";

const ALL_PERMISSIONS = [
  "create_requests", "edit_own_requests", "edit_all_requests",
  "delete_own_requests", "delete_all_requests", "view_all_requests",
  "assign_requests", "manage_users", "manage_roles", "manage_permissions",
  "manage_areas", "view_analytics", "export_data", "use_ai_features",
  "manage_settings", "manage_request_expiration",
] as const;

const DEFAULT_PERMISSIONS: Record<string, AppPermission[]> = {
  super_admin: [...ALL_PERMISSIONS] as AppPermission[],
  area_admin: [
    "create_requests","edit_own_requests","edit_all_requests","delete_own_requests",
    "delete_all_requests","view_all_requests","assign_requests","manage_users",
    "manage_roles","view_analytics","export_data","use_ai_features","manage_request_expiration",
  ],
  manager: [
    "create_requests","edit_own_requests","edit_all_requests","delete_own_requests",
    "delete_all_requests","view_all_requests","assign_requests","view_analytics",
    "export_data","use_ai_features","manage_request_expiration",
  ],
  client: ["create_requests","edit_own_requests","delete_own_requests","use_ai_features"],
  viewer: ["view_all_requests"],
};

async function assertSuperAdmin(userId: string) {
  const rows = await db<[any]>`
    SELECT 1 FROM user_roles_smart_path
    WHERE user_id = ${userId} AND role = 'super_admin' LIMIT 1
  `;
  if (rows.length === 0) throw new Error("Solo super administradores");
}

export const getRolePermissions = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getAuthContext();
  if ("error" in auth) throw new Error(auth.error);
  await assertSuperAdmin(auth.userId);

  const perms = await db<{ role: string; permission: string; enabled: boolean }[]>`
    SELECT role, permission, enabled FROM role_permissions ORDER BY role
  `;
  return { permissions: perms };
});

export const updateRolePermission = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      role: z.enum(["super_admin","area_admin","manager","client","viewer"]),
      permission: z.enum(ALL_PERMISSIONS),
      enabled: z.boolean(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    await assertSuperAdmin(auth.userId);

    await db`
      INSERT INTO role_permissions (role, permission, enabled)
      VALUES (${data.role}, ${data.permission}, ${data.enabled})
      ON CONFLICT (role, permission) DO UPDATE SET enabled = EXCLUDED.enabled
    `;
    return { ok: true };
  });

export const resetRolePermissions = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      role: z.enum(["super_admin","area_admin","manager","client","viewer"]),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    await assertSuperAdmin(auth.userId);

    const perms = DEFAULT_PERMISSIONS[data.role] ?? [];
    await db`DELETE FROM role_permissions WHERE role = ${data.role}`;
    for (const permission of perms) {
      await db`
        INSERT INTO role_permissions (role, permission, enabled)
        VALUES (${data.role}, ${permission}, true)
      `;
    }
    return { ok: true };
  });

export const getUserPermissions = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getAuthContext();
  if ("error" in auth) throw new Error(auth.error);
  const { db, userId } = auth;

  const roleRows = await db<{ role: string }[]>`
    SELECT role FROM user_roles_smart_path WHERE user_id = ${userId}
  `;
  const userRoles = roleRows.map((r) => r.role);
  if (userRoles.length === 0) return { permissions: [] };

  const permRows = await db<{ permission: string }[]>`
    SELECT DISTINCT permission FROM role_permissions
    WHERE role = ANY(${userRoles}) AND enabled = true
  `;
  return { permissions: permRows.map((p) => p.permission as AppPermission) };
});

export const checkUserPermission = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ permission: z.enum(ALL_PERMISSIONS) }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) return { hasPermission: false };
    const { db, userId } = auth;

    const roleRows = await db<{ role: string }[]>`
      SELECT role FROM user_roles_smart_path WHERE user_id = ${userId}
    `;
    const userRoles = roleRows.map((r) => r.role);
    if (userRoles.length === 0) return { hasPermission: false };

    const rows = await db<[any]>`
      SELECT 1 FROM role_permissions
      WHERE role = ANY(${userRoles})
        AND permission = ${data.permission}
        AND enabled = true
      LIMIT 1
    `;
    return { hasPermission: rows.length > 0 };
  });

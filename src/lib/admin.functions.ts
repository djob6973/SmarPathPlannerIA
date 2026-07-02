import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuthContext } from "./server-auth";
import { db } from "./db";
import { insertNotification } from "./notifications.functions";

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  area_admin:  "Admin Área",
  manager:     "Manager",
  agent:       "Agent",
  client:      "Client",
  viewer:      "Viewer",
};

export interface Area {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

async function assertSuperAdmin(userId: string) {
  const rows = await db<{ role: string }[]>`
    SELECT role FROM user_roles_smart_path
    WHERE user_id = ${userId} AND role = 'super_admin'
    LIMIT 1
  `;
  if (rows.length === 0) throw new Error("Solo super administradores");
}

async function assertSuperAdminOrAreaAdmin(userId: string) {
  const rows = await db<{ role: string }[]>`
    SELECT role FROM user_roles_smart_path
    WHERE user_id = ${userId} AND role IN ('super_admin', 'area_admin')
    LIMIT 1
  `;
  if (rows.length === 0) throw new Error("Solo super administradores o administradores de área");
}

// ── Users ──────────────────────────────────────────────────────────────────────
export const listUsers = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getAuthContext();
  if ("error" in auth) throw new Error(auth.error);
  await assertSuperAdmin(auth.userId);

  const profiles = await db<any[]>`
    SELECT id, full_name, email, created_at, area_id, is_active FROM profiles
  `;
  const roles = await db<{ user_id: string; role: string; area_id: string | null }[]>`
    SELECT user_id, role, area_id FROM user_roles_smart_path
  `;

  const byUser: Record<string, string[]> = {};
  roles.forEach((r) => {
    byUser[r.user_id] = [...(byUser[r.user_id] ?? []), r.role];
  });

  return {
    users: profiles.map((p) => ({ ...p, roles: byUser[p.id] ?? [] })),
  };
});

export const setUserRole = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["super_admin", "area_admin", "manager", "agent", "client", "viewer"]),
      enabled: z.boolean(),
      areaId: z.string().uuid().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    await assertSuperAdmin(auth.userId);

    if (data.enabled) {
      await db`
        INSERT INTO user_roles_smart_path (user_id, role, area_id)
        VALUES (${data.userId}, ${data.role}, ${data.areaId ?? null})
        ON CONFLICT (user_id, role) DO UPDATE SET area_id = EXCLUDED.area_id
      `;
      const roleLabel = ROLE_LABELS[data.role] ?? data.role;
      await insertNotification(
        db,
        data.userId,
        "role_changed",
        "Rol asignado",
        `Se te ha asignado el rol "${roleLabel}" en SmartPath Planner. Ya puedes acceder al sistema.`,
        { role: data.role, assignedBy: auth.userId }
      );
    } else {
      await db`
        DELETE FROM user_roles_smart_path
        WHERE user_id = ${data.userId} AND role = ${data.role}
      `;
    }
    return { ok: true };
  });

// ── Areas ──────────────────────────────────────────────────────────────────────
export const listAreas = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getAuthContext();
  if ("error" in auth) throw new Error(auth.error);
  await assertSuperAdmin(auth.userId);

  const areas = await db<Area[]>`SELECT * FROM areas ORDER BY name`;
  return { areas };
});

export const createArea = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    await assertSuperAdmin(auth.userId);

    const [area] = await db<Area[]>`
      INSERT INTO areas (name, description)
      VALUES (${data.name}, ${data.description ?? null})
      RETURNING *
    `;
    return { area };
  });

export const updateArea = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    await assertSuperAdmin(auth.userId);

    const updates: string[] = [];
    const values: unknown[] = [];
    if (data.name !== undefined) { updates.push(`name = $${updates.length+1}`); values.push(data.name); }
    if (data.description !== undefined) { updates.push(`description = $${updates.length+1}`); values.push(data.description); }
    if (updates.length === 0) return { area: null };

    values.push(data.id);
    const rows = await db.unsafe<Area[]>(
      `UPDATE areas SET ${updates.join(", ")} WHERE id = $${values.length} RETURNING *`,
      values as any[]
    );
    return { area: rows[0] };
  });

export const deleteArea = createServerFn({ method: "POST" })
  .inputValidator((input) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    await assertSuperAdmin(auth.userId);

    await db`DELETE FROM areas WHERE id = ${data.id}`;
    return { ok: true };
  });

export const assignUserToArea = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      areaId: z.string().uuid().nullable(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    await assertSuperAdminOrAreaAdmin(auth.userId);

    await db`
      UPDATE profiles SET area_id = ${data.areaId}
      WHERE id = ${data.userId}
    `;
    return { ok: true };
  });

export const assignSuperAdminToCurrentUser = createServerFn({ method: "POST" }).handler(
  async () => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { userId } = auth;

    const [{ count }] = await db<[{ count: string }]>`
      SELECT COUNT(*)::text AS count FROM user_roles_smart_path WHERE role = 'super_admin'
    `;
    if (count !== "0") throw new Error("Ya existe un super administrador en el sistema");

    await db`
      DELETE FROM user_roles_smart_path
      WHERE user_id = ${userId} AND role = 'admin'
    `;
    await db`
      INSERT INTO user_roles_smart_path (user_id, role)
      VALUES (${userId}, 'super_admin')
      ON CONFLICT (user_id, role) DO NOTHING
    `;
    return { ok: true };
  }
);

export const updateUserOwnArea = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ areaId: z.string().uuid().nullable() }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);

    const isSuperAdmin = await db<{ role: string }[]>`
      SELECT role FROM user_roles_smart_path WHERE user_id = ${auth.userId} AND role = 'super_admin' LIMIT 1
    `;
    if (isSuperAdmin.length === 0 && auth.userProfile.area_id !== null) {
      throw new Error("No tienes permiso para cambiar tu área");
    }

    await db`
      UPDATE profiles SET area_id = ${data.areaId}
      WHERE id = ${auth.userId}
    `;
    return { ok: true };
  });

export const updateUserProfile = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      full_name: z.string().min(1).optional(),
      email: z.string().email().optional(),
      is_active: z.boolean().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    await assertSuperAdminOrAreaAdmin(auth.userId);

    const updates: string[] = [];
    const values: unknown[] = [];
    if (data.full_name !== undefined) { updates.push(`full_name = $${updates.length + 1}`); values.push(data.full_name); }
    if (data.email !== undefined) { updates.push(`email = $${updates.length + 1}`); values.push(data.email); }
    if (data.is_active !== undefined) { updates.push(`is_active = $${updates.length + 1}`); values.push(data.is_active); }
    if (updates.length === 0) return { ok: true };

    values.push(data.userId);
    await db.unsafe(
      `UPDATE profiles SET ${updates.join(", ")} WHERE id = $${values.length}`,
      values as any[]
    );
    return { ok: true };
  });

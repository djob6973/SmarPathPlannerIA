import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuthContext } from "./server-auth";

export type AreaRow = { id: string; name: string; description: string | null; created_at: string; updated_at: string };
export type ColumnRow = { id: string; name: string; position: number; color: string; is_completed: boolean; area_id: string | null };

async function assertColumnAdmin(db: any, userId: string) {
  const rows = await db<{ role: string }[]>`
    SELECT role FROM user_roles_smart_path
    WHERE user_id = ${userId} AND role IN ('super_admin', 'area_admin')
    LIMIT 1
  `;
  if (rows.length === 0) throw new Error("Solo administradores pueden gestionar columnas");
}

async function assertSuperAdminLocal(db: any, userId: string) {
  const rows = await db<{ role: string }[]>`
    SELECT role FROM user_roles_smart_path
    WHERE user_id = ${userId} AND role = 'super_admin'
    LIMIT 1
  `;
  if (rows.length === 0) throw new Error("Solo super administradores");
}

// ── Areas ──────────────────────────────────────────────────────────────────────
export const getAreas = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getAuthContext();
  if ("error" in auth) throw new Error(auth.error);
  const areas = await auth.db<AreaRow[]>`SELECT * FROM areas ORDER BY name`;
  return { areas };
});

// ── Kanban Columns ─────────────────────────────────────────────────────────────
export const getColumns = createServerFn({ method: "GET" })
  .inputValidator((input: { areaId?: string | null }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userProfile } = auth;

    const effectiveAreaId = data.areaId !== undefined ? data.areaId : userProfile.area_id;

    const columns = effectiveAreaId
      ? await db<ColumnRow[]>`
          SELECT * FROM kanban_columns
          WHERE area_id = ${effectiveAreaId} OR area_id IS NULL
          ORDER BY position`
      : await db<ColumnRow[]>`SELECT * FROM kanban_columns ORDER BY position`;

    return { columns };
  });

export const createColumn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      name: z.string().min(1),
      color: z.string().default("#D5D6D7"),
      is_completed: z.boolean().default(false),
      position: z.number().int().optional(),
      area_id: z.string().uuid().nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userProfile } = auth;
    await assertColumnAdmin(db, auth.userId);

    const areaId = data.area_id !== undefined ? data.area_id : userProfile.area_id;

    let position = data.position;
    if (position === undefined) {
      const [{ max }] = await db<[{ max: number | null }]>`
        SELECT MAX(position) AS max FROM kanban_columns
      `;
      position = (max ?? -1) + 1;
    }

    const rows = await db<ColumnRow[]>`
      INSERT INTO kanban_columns (name, color, is_completed, position, area_id)
      VALUES (${data.name}, ${data.color}, ${data.is_completed}, ${position}, ${areaId})
      RETURNING *
    `;
    return { column: rows[0] };
  });

export const updateColumn = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      color: z.string().optional(),
      is_completed: z.boolean().optional(),
      position: z.number().int().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db } = auth;
    await assertColumnAdmin(db, auth.userId);

    const { id, ...fields } = data;
    const updates: string[] = [];
    const values: unknown[] = [];

    if (fields.name !== undefined) { updates.push(`name = $${updates.length + 1}`); values.push(fields.name); }
    if (fields.color !== undefined) { updates.push(`color = $${updates.length + 1}`); values.push(fields.color); }
    if (fields.is_completed !== undefined) { updates.push(`is_completed = $${updates.length + 1}`); values.push(fields.is_completed); }
    if (fields.position !== undefined) { updates.push(`position = $${updates.length + 1}`); values.push(fields.position); }

    if (updates.length === 0) return { ok: true };

    values.push(id);
    await db.unsafe(
      `UPDATE kanban_columns SET ${updates.join(", ")} WHERE id = $${values.length}`,
      values as any[]
    );
    return { ok: true };
  });

export const deleteColumn = createServerFn({ method: "POST" })
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    await assertColumnAdmin(auth.db, auth.userId);
    await auth.db`DELETE FROM kanban_columns WHERE id = ${data.id}`;
    return { ok: true };
  });

// ── Profiles list (for user-picker in modals) ─────────────────────────────────
export const listProfiles = createServerFn({ method: "GET" }).handler(async () => {
  const auth = await getAuthContext();
  if ("error" in auth) throw new Error(auth.error);
  const { db, userId, userProfile } = auth;

  const isSuperAdmin = await db<{ role: string }[]>`
    SELECT role FROM user_roles_smart_path WHERE user_id = ${userId} AND role = 'super_admin' LIMIT 1
  `;
  const rows = isSuperAdmin.length > 0
    ? await db<{ id: string; full_name: string | null }[]>`SELECT id, full_name FROM profiles ORDER BY full_name`
    : await db<{ id: string; full_name: string | null }[]>`
        SELECT id, full_name FROM profiles
        WHERE area_id = ${userProfile.area_id}
        ORDER BY full_name
      `;
  return { profiles: rows };
});

// ── AI Settings ────────────────────────────────────────────────────────────────
export const getAiSettings = createServerFn({ method: "GET" })
  .inputValidator((input: { areaId?: string | null }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db } = auth;

    const rows = await db<any[]>`
      SELECT * FROM ai_settings
      WHERE is_active = true
      ORDER BY updated_at DESC
      LIMIT 1
    `;
    return { settings: rows[0] ?? null };
  });

export const updateAiSettings = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid().optional(),
      system_prompt: z.string().optional(),
      intake_questions: z.array(z.string()).optional(),
      model: z.string().optional(),
      area_id: z.string().uuid().nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db } = auth;
    await assertSuperAdminLocal(db, auth.userId);

    if (data.id) {
      const updates: string[] = [];
      const values: unknown[] = [];
      if (data.system_prompt !== undefined) { updates.push(`system_prompt = $${updates.length+1}`); values.push(data.system_prompt); }
      if (data.intake_questions !== undefined) { updates.push(`intake_questions = $${updates.length+1}`); values.push(JSON.stringify(data.intake_questions)); }
      if (data.model !== undefined) { updates.push(`model = $${updates.length+1}`); values.push(data.model); }
      values.push(data.id);
      if (updates.length > 0) {
        await db.unsafe(`UPDATE ai_settings SET ${updates.join(", ")} WHERE id = $${values.length}`, values as any[]);
      }
    } else {
      await db`
        INSERT INTO ai_settings (system_prompt, intake_questions, model, area_id)
        VALUES (
          ${data.system_prompt ?? 'Eres un asistente útil.'},
          ${JSON.stringify(data.intake_questions ?? [])},
          ${data.model ?? 'gpt-4o-mini'},
          ${data.area_id ?? null}
        )
      `;
    }
    return { ok: true };
  });

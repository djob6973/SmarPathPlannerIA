import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuthContext } from "./server-auth";

// ── Types ─────────────────────────────────────────────────────────────────────
export type RequestRow = {
  id: string; title: string; description: string | null; objective: string | null;
  process: string | null; priority: string; status_column_id: string | null;
  created_by: string; assigned_to: string | null; area_id: string | null;
  position: number; expires_at: string | null; created_at: string; updated_at: string;
};
export type ColumnRow = { id: string; name: string; position: number; color: string; is_completed: boolean; area_id: string | null };
export type CommentRow = { id: string; request_id: string; user_id: string; content: string; created_at: string; updated_at: string };
export type ProfileRow = { id: string; full_name: string | null; email: string };

// ── Board / list data ──────────────────────────────────────────────────────────
export const getRequestsData = createServerFn({ method: "GET" })
  .inputValidator((input: { areaId?: string | null }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userProfile, userId } = auth;

    const effectiveAreaId =
      data.areaId !== undefined ? data.areaId : userProfile.area_id;

    const [columns, requests] = await Promise.all([
      db<ColumnRow[]>`SELECT * FROM kanban_columns ORDER BY position`,
      effectiveAreaId
        ? db<RequestRow[]>`
            SELECT * FROM requests
            WHERE area_id = ${effectiveAreaId}
            ORDER BY position ASC, updated_at DESC`
        : db<RequestRow[]>`
            SELECT * FROM requests
            ORDER BY position ASC, updated_at DESC`,
    ]);

    return { columns, requests };
  });

// ── Single request detail ──────────────────────────────────────────────────────
export const getRequestDetails = createServerFn({ method: "GET" })
  .inputValidator((input: { requestId: string }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db } = auth;

    const [requests, columns, comments] = await Promise.all([
      db<RequestRow[]>`SELECT * FROM requests WHERE id = ${data.requestId}`,
      db<ColumnRow[]>`SELECT id, name, color, position, is_completed FROM kanban_columns ORDER BY position`,
      db<CommentRow[]>`SELECT * FROM comments WHERE request_id = ${data.requestId} ORDER BY created_at`,
    ]);

    const request = requests[0] ?? null;
    const profileMap: Record<string, ProfileRow> = {};

    if (request) {
      const userIds = [
        ...new Set(
          [request.created_by, request.assigned_to, ...comments.map((c) => c.user_id)].filter(
            Boolean
          )
        ),
      ] as string[];

      if (userIds.length > 0) {
        const profileList = await db<ProfileRow[]>`
          SELECT id, full_name, email FROM profiles WHERE id = ANY(${userIds})
        `;
        profileList.forEach((p) => { profileMap[p.id] = p; });
      }
    }

    const allUsers = await db<ProfileRow[]>`
      SELECT id, full_name, email FROM profiles ORDER BY full_name
    `;

    return { request, columns, comments, profiles: profileMap, availableUsers: allUsers };
  });

// ── Create request ─────────────────────────────────────────────────────────────
export const createRequest = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      title: z.string().min(1),
      description: z.string().nullable().optional(),
      objective: z.string().nullable().optional(),
      process: z.string().nullable().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
      status_column_id: z.string().uuid().nullable().optional(),
      assigned_to: z.string().uuid().nullable().optional(),
      area_id: z.string().uuid().nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId, userProfile } = auth;

    const areaId = data.area_id ?? userProfile.area_id;

    const rows = await db<RequestRow[]>`
      INSERT INTO requests (title, description, objective, process, priority, status_column_id, assigned_to, created_by, area_id)
      VALUES (
        ${data.title},
        ${data.description ?? null},
        ${data.objective ?? null},
        ${data.process ?? null},
        ${data.priority},
        ${data.status_column_id ?? null},
        ${data.assigned_to ?? null},
        ${userId},
        ${areaId}
      )
      RETURNING *
    `;
    return { request: rows[0] };
  });

// ── Update request ─────────────────────────────────────────────────────────────
export const updateRequest = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      requestId: z.string().uuid(),
      title: z.string().min(1).optional(),
      description: z.string().nullable().optional(),
      objective: z.string().nullable().optional(),
      process: z.string().nullable().optional(),
      priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
      status_column_id: z.string().uuid().nullable().optional(),
      assigned_to: z.string().uuid().nullable().optional(),
      position: z.number().int().optional(),
      expires_at: z.string().nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db } = auth;

    const { requestId, ...fields } = data;
    const updates: string[] = [];
    const values: unknown[] = [];

    if (fields.title !== undefined) { updates.push(`title = $${updates.length + 1}`); values.push(fields.title); }
    if (fields.description !== undefined) { updates.push(`description = $${updates.length + 1}`); values.push(fields.description); }
    if (fields.objective !== undefined) { updates.push(`objective = $${updates.length + 1}`); values.push(fields.objective); }
    if (fields.process !== undefined) { updates.push(`process = $${updates.length + 1}`); values.push(fields.process); }
    if (fields.priority !== undefined) { updates.push(`priority = $${updates.length + 1}`); values.push(fields.priority); }
    if (fields.status_column_id !== undefined) { updates.push(`status_column_id = $${updates.length + 1}`); values.push(fields.status_column_id); }
    if (fields.assigned_to !== undefined) { updates.push(`assigned_to = $${updates.length + 1}`); values.push(fields.assigned_to); }
    if (fields.position !== undefined) { updates.push(`position = $${updates.length + 1}`); values.push(fields.position); }
    if (fields.expires_at !== undefined) { updates.push(`expires_at = $${updates.length + 1}`); values.push(fields.expires_at); }

    if (updates.length === 0) return { ok: true };

    values.push(requestId);
    await db.unsafe(
      `UPDATE requests SET ${updates.join(", ")} WHERE id = $${values.length}`,
      values as any[]
    );
    return { ok: true };
  });

// ── Delete single request ──────────────────────────────────────────────────────
export const deleteRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { requestId: string }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db } = auth;
    await db`DELETE FROM requests WHERE id = ${data.requestId}`;
    return { ok: true };
  });

// ── Bulk delete requests ───────────────────────────────────────────────────────
export const deleteRequests = createServerFn({ method: "POST" })
  .inputValidator((input: { ids: string[] }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db } = auth;
    if (data.ids.length === 0) return { ok: true };
    await db`DELETE FROM requests WHERE id = ANY(${data.ids})`;
    return { ok: true };
  });

// ── Copy request ───────────────────────────────────────────────────────────────
export const copyRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { requestId: string }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId } = auth;

    const rows = await db<RequestRow[]>`SELECT * FROM requests WHERE id = ${data.requestId}`;
    const original = rows[0];
    if (!original) throw new Error("Solicitud no encontrada");

    const copied = await db<RequestRow[]>`
      INSERT INTO requests (title, description, objective, process, priority, status_column_id, created_by, area_id)
      VALUES (
        ${original.title + " (copia)"},
        ${original.description},
        ${original.objective},
        ${original.process},
        ${original.priority},
        ${original.status_column_id},
        ${userId},
        ${original.area_id}
      )
      RETURNING *
    `;
    return { request: copied[0] };
  });

// ── Comments ───────────────────────────────────────────────────────────────────
export const addComment = createServerFn({ method: "POST" })
  .inputValidator((input: { requestId: string; content: string }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId } = auth;

    const rows = await db<CommentRow[]>`
      INSERT INTO comments (request_id, user_id, content)
      VALUES (${data.requestId}, ${userId}, ${data.content})
      RETURNING *
    `;
    return { comment: rows[0] };
  });

export const updateComment = createServerFn({ method: "POST" })
  .inputValidator((input: { commentId: string; content: string }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId } = auth;

    await db`
      UPDATE comments SET content = ${data.content}
      WHERE id = ${data.commentId} AND user_id = ${userId}
    `;
    return { ok: true };
  });

export const deleteComment = createServerFn({ method: "POST" })
  .inputValidator((input: { commentId: string }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId } = auth;

    await db`
      DELETE FROM comments
      WHERE id = ${data.commentId}
        AND (user_id = ${userId} OR EXISTS (
          SELECT 1 FROM user_roles_smart_path
          WHERE user_id = ${userId} AND role IN ('super_admin','area_admin','manager')
        ))
    `;
    return { ok: true };
  });

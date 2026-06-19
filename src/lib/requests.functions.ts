import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { getAuthContext } from "./server-auth";
import { insertNotification } from "./notifications.functions";

// ── Types ─────────────────────────────────────────────────────────────────────
export type RequestRow = {
  id: string; title: string; description: string | null; objective: string | null;
  process: string | null; priority: string; status_column_id: string | null;
  created_by: string; assigned_to: string | null; area_id: string | null;
  position: number; expires_at: string | null; completed_at: string | null;
  parent_request_id: string | null;
  created_at: string; updated_at: string;
};
export type ColumnRow = { id: string; name: string; position: number; color: string; is_completed: boolean; area_id: string | null };
export type CommentRow = { id: string; request_id: string; user_id: string; content: string; created_at: string; updated_at: string };
export type ProfileRow = { id: string; full_name: string | null; email: string };
export type DeliverableRow = {
  id: string; request_id: string; title: string; notes: string | null;
  delivered_at: string | null; created_by: string; created_at: string; updated_at: string;
};

// ── Auth helpers ───────────────────────────────────────────────────────────────
async function getCallerRoles(db: any, userId: string): Promise<Set<string>> {
  const rows = await db<{ role: string }[]>`SELECT role FROM user_roles_smart_path WHERE user_id = ${userId}`;
  return new Set(rows.map((r: any) => r.role));
}

async function getCallerPermissions(db: any, userId: string): Promise<Set<string>> {
  const roleRows = await db<{ role: string }[]>`SELECT role FROM user_roles_smart_path WHERE user_id = ${userId}`;
  const roles = roleRows.map((r: any) => r.role);
  if (roles.length === 0) return new Set();
  const permRows = await db<{ permission: string }[]>`
    SELECT DISTINCT permission FROM role_permissions
    WHERE role = ANY(${roles}) AND enabled = true
  `;
  return new Set(permRows.map((p: any) => p.permission));
}

// ── Board / list data ──────────────────────────────────────────────────────────
export const getRequestsData = createServerFn({ method: "GET" })
  .inputValidator((input: { areaId?: string | null }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userProfile, userId } = auth;

    const effectiveAreaId =
      data.areaId !== undefined ? data.areaId : userProfile.area_id;

    const permissions = await getCallerPermissions(db, userId);
    const canViewAll = permissions.has("view_all_requests");

    const [columns, requests] = await Promise.all([
      db<ColumnRow[]>`SELECT * FROM kanban_columns ORDER BY position`,
      effectiveAreaId
        ? canViewAll
          ? db<RequestRow[]>`
              SELECT * FROM requests
              WHERE area_id = ${effectiveAreaId}
              ORDER BY position ASC, updated_at DESC`
          : db<RequestRow[]>`
              SELECT * FROM requests
              WHERE area_id = ${effectiveAreaId}
                AND (created_by = ${userId} OR assigned_to = ${userId})
              ORDER BY position ASC, updated_at DESC`
        : canViewAll
          ? db<RequestRow[]>`
              SELECT * FROM requests
              ORDER BY position ASC, updated_at DESC`
          : db<RequestRow[]>`
              SELECT * FROM requests
              WHERE (created_by = ${userId} OR assigned_to = ${userId})
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

    const [requests, columns, comments, children, deliverables] = await Promise.all([
      db<RequestRow[]>`SELECT * FROM requests WHERE id = ${data.requestId}`,
      db<ColumnRow[]>`SELECT id, name, color, position, is_completed FROM kanban_columns ORDER BY position`,
      db<CommentRow[]>`SELECT * FROM comments WHERE request_id = ${data.requestId} ORDER BY created_at`,
      db<RequestRow[]>`SELECT * FROM requests WHERE parent_request_id = ${data.requestId} ORDER BY created_at`,
      db<DeliverableRow[]>`SELECT * FROM request_deliverables WHERE request_id = ${data.requestId} ORDER BY created_at`,
    ]);

    const request = requests[0] ?? null;

    let parent: RequestRow | null = null;
    if (request?.parent_request_id) {
      const parentRows = await db<RequestRow[]>`SELECT * FROM requests WHERE id = ${request.parent_request_id}`;
      parent = parentRows[0] ?? null;
    }

    const profileMap: Record<string, ProfileRow> = {};

    if (request) {
      const userIds = [
        ...new Set(
          [request.created_by, request.assigned_to, ...comments.map((c) => c.user_id)].filter(Boolean)
        ),
      ] as string[];

      if (userIds.length > 0) {
        const profileList = await db<ProfileRow[]>`
          SELECT id, full_name, email FROM profiles WHERE id = ANY(${userIds})
        `;
        profileList.forEach((p) => { profileMap[p.id] = p; });
      }
    }

    const allUsers = await db<{ id: string; full_name: string | null }[]>`
      SELECT id, full_name FROM profiles ORDER BY full_name
    `;

    return { request, columns, comments, profiles: profileMap, availableUsers: allUsers, parent, children, deliverables };
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
      parent_request_id: z.string().uuid().nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId, userProfile } = auth;

    const areaId = data.area_id ?? userProfile.area_id;

    const rows = await db<RequestRow[]>`
      INSERT INTO requests (title, description, objective, process, priority, status_column_id, assigned_to, created_by, area_id, parent_request_id)
      VALUES (
        ${data.title},
        ${data.description ?? null},
        ${data.objective ?? null},
        ${data.process ?? null},
        ${data.priority},
        ${data.status_column_id ?? null},
        ${data.assigned_to ?? null},
        ${userId},
        ${areaId},
        ${data.parent_request_id ?? null}
      )
      RETURNING *
    `;
    const req = rows[0];

    // Notify assignee if different from creator
    if (req.assigned_to && req.assigned_to !== userId) {
      await insertNotification(
        db,
        req.assigned_to,
        "request_assigned",
        "Solicitud asignada",
        `Se te asignó la solicitud: ${req.title}`,
        { requestId: req.id }
      );
    }

    // Notify managers, area_admins and super_admins about the new request
    if (areaId) {
      const managers = await db<{ id: string }[]>`
        SELECT DISTINCT user_id AS id FROM user_roles_smart_path
        WHERE (
          role = 'super_admin'
          OR (role IN ('area_admin', 'manager') AND area_id = ${areaId})
        )
        AND user_id != ${userId}
      `;
      for (const m of managers) {
        await insertNotification(
          db,
          m.id,
          "request_created",
          "Nueva solicitud creada",
          `"${req.title}" fue creada y está pendiente de atención`,
          { requestId: req.id }
        );
      }
    }

    return { request: req };
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
      completed_at: z.string().nullable().optional(),
      parent_request_id: z.string().uuid().nullable().optional(),
      area_id: z.string().uuid().nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId } = auth;

    const { requestId, ...fields } = data;

    // Always fetch current state — needed for auth check and notifications
    const prevRows = await db<RequestRow[]>`SELECT * FROM requests WHERE id = ${requestId}`;
    const prev = prevRows[0] ?? null;
    if (!prev) throw new Error("Solicitud no encontrada");

    const [roles, permissions] = await Promise.all([
      getCallerRoles(db, userId),
      getCallerPermissions(db, userId),
    ]);
    const canEditAll = roles.has("super_admin") || roles.has("area_admin") || roles.has("manager");
    if (!canEditAll) {
      if (prev.created_by !== userId) throw new Error("No tienes permiso para editar esta solicitud");
      if (prev.area_id && prev.area_id !== auth.userProfile.area_id) throw new Error("Solicitud fuera de tu área");
    } else if (!roles.has("super_admin") && prev.area_id && prev.area_id !== auth.userProfile.area_id) {
      throw new Error("Solicitud fuera de tu área");
    }

    if (fields.assigned_to !== undefined && fields.assigned_to !== prev.assigned_to) {
      if (!permissions.has("assign_requests")) {
        throw new Error("No tienes permiso para asignar solicitudes");
      }
    }

    if (fields.status_column_id !== undefined && fields.status_column_id !== prev.status_column_id) {
      if (!permissions.has("change_request_status") && !permissions.has("edit_all_requests")) {
        throw new Error("No tienes permiso para cambiar el estado de esta solicitud");
      }
    }

    if (fields.area_id !== undefined && fields.area_id !== prev.area_id) {
      if (!roles.has("super_admin")) {
        throw new Error("Solo el super administrador puede cambiar el área de una solicitud");
      }
    }

    // Auto-manage completed_at when status column changes
    let targetIsCompleted = false;
    if (fields.status_column_id !== undefined && fields.completed_at === undefined) {
      if (fields.status_column_id) {
        const cols = await db<{ is_completed: boolean }[]>`
          SELECT is_completed FROM kanban_columns WHERE id = ${fields.status_column_id}
        `;
        targetIsCompleted = cols[0]?.is_completed ?? false;
        if (targetIsCompleted && !prev?.completed_at) {
          fields.completed_at = new Date().toISOString();
        } else if (!targetIsCompleted) {
          fields.completed_at = null;
        }
      } else {
        fields.completed_at = null;
      }
    }

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
    if (fields.completed_at !== undefined) { updates.push(`completed_at = $${updates.length + 1}`); values.push(fields.completed_at); }
    if (fields.parent_request_id !== undefined) { updates.push(`parent_request_id = $${updates.length + 1}`); values.push(fields.parent_request_id); }
    if (fields.area_id !== undefined) { updates.push(`area_id = $${updates.length + 1}`); values.push(fields.area_id); }

    if (updates.length === 0) return { ok: true };

    values.push(requestId);
    await db.unsafe(
      `UPDATE requests SET ${updates.join(", ")} WHERE id = $${values.length}`,
      values as any[]
    );

    if (prev) {
      const requestTitle = fields.title ?? prev.title;

      // Notify newly assigned user (if changed and different from updater)
      if (
        fields.assigned_to !== undefined &&
        fields.assigned_to &&
        fields.assigned_to !== prev.assigned_to &&
        fields.assigned_to !== userId
      ) {
        await insertNotification(
          db,
          fields.assigned_to,
          "request_assigned",
          "Solicitud asignada",
          `Se te asignó la solicitud: ${requestTitle}`,
          { requestId }
        );
      }

      // Notify creator and assignee when status changes
      if (
        fields.status_column_id !== undefined &&
        fields.status_column_id !== prev.status_column_id
      ) {
        const notify = new Set<string>();
        if (prev.created_by && prev.created_by !== userId) notify.add(prev.created_by);
        const currentAssignee = fields.assigned_to ?? prev.assigned_to;
        if (currentAssignee && currentAssignee !== userId) notify.add(currentAssignee);

        const notifType  = targetIsCompleted ? "request_completed" : "status_changed";
        const notifTitle = targetIsCompleted ? "Solicitud completada"  : "Estado actualizado";
        const notifBody  = targetIsCompleted
          ? `La solicitud "${requestTitle}" fue marcada como completada`
          : `La solicitud "${requestTitle}" cambió de estado`;

        for (const recipientId of notify) {
          await insertNotification(db, recipientId, notifType, notifTitle, notifBody, { requestId });
        }
      }

      // Notify creator and assignee when priority changes
      if (fields.priority !== undefined && fields.priority !== prev.priority) {
        const PRIORITY_LABELS: Record<string, string> = {
          urgent: "Urgente", high: "Alta", medium: "Media", low: "Baja",
        };
        const notify = new Set<string>();
        if (prev.created_by && prev.created_by !== userId) notify.add(prev.created_by);
        const currentAssignee = fields.assigned_to ?? prev.assigned_to;
        if (currentAssignee && currentAssignee !== userId) notify.add(currentAssignee);

        for (const recipientId of notify) {
          await insertNotification(
            db, recipientId,
            "priority_changed",
            "Prioridad actualizada",
            `La prioridad de "${requestTitle}" cambió a ${PRIORITY_LABELS[fields.priority] ?? fields.priority}`,
            { requestId }
          );
        }
      }
    }

    return { ok: true };
  });

// ── Delete single request ──────────────────────────────────────────────────────
export const deleteRequest = createServerFn({ method: "POST" })
  .inputValidator((input: { requestId: string }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId } = auth;

    const rows = await db<RequestRow[]>`SELECT created_by, area_id FROM requests WHERE id = ${data.requestId}`;
    if (!rows.length) return { ok: true };
    const target = rows[0];

    const roles = await getCallerRoles(db, userId);
    const canDeleteAll = roles.has("super_admin") || roles.has("area_admin") || roles.has("manager");
    if (!canDeleteAll && target.created_by !== userId) throw new Error("No tienes permiso para eliminar esta solicitud");

    await db`DELETE FROM requests WHERE id = ${data.requestId}`;
    return { ok: true };
  });

// ── Bulk delete requests ───────────────────────────────────────────────────────
export const deleteRequests = createServerFn({ method: "POST" })
  .inputValidator((input: { ids: string[] }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId } = auth;
    if (data.ids.length === 0) return { ok: true };

    const roles = await getCallerRoles(db, userId);
    const canDeleteAll = roles.has("super_admin") || roles.has("area_admin") || roles.has("manager");
    if (canDeleteAll) {
      await db`DELETE FROM requests WHERE id = ANY(${data.ids})`;
    } else {
      await db`DELETE FROM requests WHERE id = ANY(${data.ids}) AND created_by = ${userId}`;
    }
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

    const roles = await getCallerRoles(db, userId);
    if (!roles.has("super_admin") && original.area_id && original.area_id !== auth.userProfile.area_id) {
      throw new Error("No tienes acceso a esta solicitud");
    }

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

    // Notify request creator and assignee (excluding commenter)
    const reqRows = await db<RequestRow[]>`
      SELECT title, created_by, assigned_to FROM requests WHERE id = ${data.requestId}
    `;
    const req = reqRows[0];
    if (req) {
      const notify = new Set<string>();
      if (req.created_by && req.created_by !== userId) notify.add(req.created_by);
      if (req.assigned_to && req.assigned_to !== userId) notify.add(req.assigned_to);

      for (const recipientId of notify) {
        await insertNotification(
          db,
          recipientId,
          "comment_added",
          "Nuevo comentario",
          `Nuevo comentario en la solicitud: ${req.title}`,
          { requestId: data.requestId }
        );
      }
    }

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

// ── Deliverables ───────────────────────────────────────────────────────────────
export const addDeliverable = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      requestId: z.string().uuid(),
      title: z.string().min(1),
      notes: z.string().nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId } = auth;

    const roles = await getCallerRoles(db, userId);
    if (!roles.has("super_admin")) {
      const reqRows = await db<{ area_id: string | null }[]>`SELECT area_id FROM requests WHERE id = ${data.requestId}`;
      if (reqRows.length && reqRows[0].area_id && reqRows[0].area_id !== auth.userProfile.area_id) {
        throw new Error("No tienes acceso a esta solicitud");
      }
    }

    const rows = await db<DeliverableRow[]>`
      INSERT INTO request_deliverables (request_id, title, notes, created_by)
      VALUES (${data.requestId}, ${data.title}, ${data.notes ?? null}, ${userId})
      RETURNING *
    `;
    return { deliverable: rows[0] };
  });

export const updateDeliverable = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      deliverableId: z.string().uuid(),
      title: z.string().min(1),
      notes: z.string().nullable().optional(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db } = auth;
    await db`
      UPDATE request_deliverables
      SET title = ${data.title}, notes = ${data.notes ?? null}
      WHERE id = ${data.deliverableId}
    `;
    return { ok: true };
  });

export const toggleDeliverable = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({
      deliverableId: z.string().uuid(),
      delivered: z.boolean(),
    }).parse(input)
  )
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId } = auth;

    const roles = await getCallerRoles(db, userId);
    if (!roles.has("super_admin") && !roles.has("area_admin") && !roles.has("manager")) {
      const delRows = await db<{ area_id: string | null }[]>`
        SELECT r.area_id FROM request_deliverables d
        JOIN requests r ON r.id = d.request_id
        WHERE d.id = ${data.deliverableId}
      `;
      if (delRows.length && delRows[0].area_id && delRows[0].area_id !== auth.userProfile.area_id) {
        throw new Error("No tienes acceso a este entregable");
      }
    }

    const deliveredAt = data.delivered ? new Date().toISOString() : null;
    await db`UPDATE request_deliverables SET delivered_at = ${deliveredAt} WHERE id = ${data.deliverableId}`;
    return { ok: true, delivered_at: deliveredAt };
  });

export const deleteDeliverable = createServerFn({ method: "POST" })
  .inputValidator((input: { deliverableId: string }) => input)
  .handler(async ({ data }) => {
    const auth = await getAuthContext();
    if ("error" in auth) throw new Error(auth.error);
    const { db, userId } = auth;

    const roles = await getCallerRoles(db, userId);
    const canDeleteAll = roles.has("super_admin") || roles.has("area_admin") || roles.has("manager");
    if (canDeleteAll) {
      await db`DELETE FROM request_deliverables WHERE id = ${data.deliverableId}`;
    } else {
      await db`DELETE FROM request_deliverables WHERE id = ${data.deliverableId} AND created_by = ${userId}`;
    }
    return { ok: true };
  });

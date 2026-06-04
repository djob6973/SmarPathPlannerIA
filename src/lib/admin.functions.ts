import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export interface Area {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles_smart_path").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Solo super administradores");
}

async function assertSuperAdminOrAreaAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles_smart_path").select("role").eq("user_id", userId).or("role.eq.super_admin,role.eq.area_admin").maybeSingle();
  if (!data) throw new Error("Solo super administradores o administradores de área");
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: profiles } = await (supabaseAdmin as any).from("profiles").select("id, full_name, email, created_at, area_id");
    const { data: roles } = await (supabaseAdmin as any).from("user_roles_smart_path").select("user_id, role, area_id");
    const byUser: Record<string, string[]> = {};
    (roles ?? []).forEach((r: any) => {
      byUser[r.user_id] = [...(byUser[r.user_id] ?? []), r.role];
    });
    return {
      users: (profiles ?? []).map((p: any) => ({ ...p, roles: byUser[p.id] ?? [] })),
    };
  });

export const setUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      role: z.enum(["super_admin", "area_admin", "manager", "client", "viewer"]),
      enabled: z.boolean(),
      areaId: z.string().uuid().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    if (data.enabled) {
      await supabaseAdmin.from("user_roles_smart_path").upsert({
        user_id: data.userId,
        role: data.role,
        area_id: data.areaId || null
      }, { onConflict: "user_id,role" });
    } else {
      await supabaseAdmin.from("user_roles_smart_path").delete().eq("user_id", data.userId).eq("role", data.role);
    }
    return { ok: true };
  });

export const listAreas = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: areas } = await (supabaseAdmin as any).from("areas").select("*").order("name");
    return { areas: areas ?? [] };
  });

export const createArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: area, error } = await (supabaseAdmin as any)
      .from("areas")
      .insert({ name: data.name, description: data.description || null })
      .select()
      .single();
    if (error) throw error;
    return { area };
  });

export const updateArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data: area, error } = await (supabaseAdmin as any)
      .from("areas")
      .update({
        ...(data.name && { name: data.name }),
        ...(data.description !== undefined && { description: data.description }),
      })
      .eq("id", data.id)
      .select()
      .single();
    if (error) throw error;
    return { area };
  });

export const deleteArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      id: z.string().uuid(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await (supabaseAdmin as any).from("areas").delete().eq("id", data.id);
    if (error) throw error;
    return { ok: true };
  });

export const assignUserToArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      userId: z.string().uuid(),
      areaId: z.string().uuid().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertSuperAdminOrAreaAdmin(context.supabase, context.userId);
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ area_id: data.areaId })
      .eq("id", data.userId);
    if (error) throw error;
    return { ok: true };
  });

export const assignSuperAdminToCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    // Delete any existing admin role (if it still exists)
    await (supabaseAdmin as any)
      .from("user_roles_smart_path")
      .delete()
      .eq("user_id", context.userId)
      .eq("role", "admin");

    // Assign super_admin role
    const { error } = await (supabaseAdmin as any)
      .from("user_roles_smart_path")
      .upsert({
        user_id: context.userId,
        role: "super_admin"
      }, { onConflict: "user_id,role" });

    if (error) throw error;
    return { ok: true };
  });

export const updateUserOwnArea = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      areaId: z.string().uuid().nullable(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { error } = await (supabaseAdmin as any)
      .from("profiles")
      .update({ area_id: data.areaId })
      .eq("id", context.userId);
    if (error) throw error;
    return { ok: true };
  });
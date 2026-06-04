import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { AppPermission, AppRole, RolePermission, RolePermissionsConfig } from "./permissions.types";

async function assertAdmin(supabase: any, userId: string) {
  const { data } = await supabase.from("user_roles_smart_path").select("role").eq("user_id", userId).eq("role", "super_admin").maybeSingle();
  if (!data) throw new Error("Solo super administradores");
}

export const getRolePermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { data } = await supabaseAdmin.from("role_permissions" as any).select("role, permission, enabled").order("role", { ascending: true });
    return { permissions: data ?? [] };
  });

export const updateRolePermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({
      role: z.enum(["super_admin", "area_admin", "admin", "manager", "client", "viewer"]),
      permission: z.enum([
        "create_requests",
        "edit_own_requests",
        "edit_all_requests",
        "delete_own_requests",
        "delete_all_requests",
        "view_all_requests",
        "assign_requests",
        "manage_users",
        "manage_roles",
        "manage_permissions",
        "manage_areas",
        "view_analytics",
        "export_data",
        "use_ai_features",
        "manage_settings",
        "manage_request_expiration",
      ]),
      enabled: z.boolean(),
    }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase, context.userId);
    const { error } = await supabaseAdmin
      .from("role_permissions" as any)
      .upsert({ role: data.role, permission: data.permission, enabled: data.enabled }, { onConflict: "role,permission" });
    if (error) {
      console.error("[updateRolePermission] Error:", error);
      throw new Error(error.message);
    }
    return { ok: true };
  });

export const resetRolePermissions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z.object({
      role: z.enum(["super_admin", "area_admin", "admin", "manager", "client", "viewer"]),
    }).parse(input),
  )
  .handler(async ({ data, context }: any) => {
    await assertAdmin(context.supabase, context.userId);
    
    const defaultPermissions: Record<string, AppPermission[]> = {
      super_admin: [
        "create_requests",
        "edit_own_requests",
        "edit_all_requests",
        "delete_own_requests",
        "delete_all_requests",
        "view_all_requests",
        "assign_requests",
        "manage_users",
        "manage_roles",
        "manage_permissions",
        "manage_areas",
        "view_analytics",
        "export_data",
        "use_ai_features",
        "manage_settings",
        "manage_request_expiration",
      ],
      area_admin: [
        "create_requests",
        "edit_own_requests",
        "edit_all_requests",
        "delete_own_requests",
        "delete_all_requests",
        "view_all_requests",
        "assign_requests",
        "manage_users",
        "manage_roles",
        "view_analytics",
        "export_data",
        "use_ai_features",
        "manage_request_expiration",
      ],
      admin: [
        "create_requests",
        "edit_own_requests",
        "edit_all_requests",
        "delete_own_requests",
        "delete_all_requests",
        "view_all_requests",
        "assign_requests",
        "manage_users",
        "manage_roles",
        "manage_permissions",
        "view_analytics",
        "export_data",
        "use_ai_features",
        "manage_settings",
        "manage_request_expiration",
      ],
      manager: [
        "create_requests",
        "edit_own_requests",
        "edit_all_requests",
        "delete_own_requests",
        "delete_all_requests",
        "view_all_requests",
        "assign_requests",
        "view_analytics",
        "export_data",
        "use_ai_features",
        "manage_request_expiration",
      ],
      client: ["create_requests", "edit_own_requests", "delete_own_requests", "use_ai_features"],
      viewer: ["view_all_requests"],
    };

    const permissions = defaultPermissions[data.role as AppRole];
    
    // Delete all existing permissions for this role
    await supabaseAdmin.from("role_permissions" as any).delete().eq("role", data.role);
    
    // Insert default permissions
    for (const permission of permissions) {
      await supabaseAdmin
        .from("role_permissions" as any)
        .insert({ role: data.role, permission, enabled: true });
    }
    
    return { ok: true };
  });

export const getUserPermissions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }: any) => {
    const { data: roles } = await context.supabase.from("user_roles_smart_path").select("role").eq("user_id", context.userId);
    const userRoles = (roles ?? []).map((r: any) => r.role as AppRole);
    
    if (userRoles.length === 0) return { permissions: [] };
    
    const { data: permissions } = await supabaseAdmin
      .from("role_permissions" as any)
      .select("permission")
      .in("role", userRoles)
      .eq("enabled", true);
    
    const uniquePermissions = new Set((permissions ?? []).map((p: any) => p.permission as AppPermission));
    return { permissions: Array.from(uniquePermissions) };
  });

export const checkUserPermission = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: any) =>
    z.object({
      permission: z.enum([
        "create_requests",
        "edit_own_requests",
        "edit_all_requests",
        "delete_own_requests",
        "delete_all_requests",
        "view_all_requests",
        "assign_requests",
        "manage_users",
        "manage_roles",
        "manage_permissions",
        "view_analytics",
        "export_data",
        "use_ai_features",
        "manage_settings",
        "manage_request_expiration",
      ]),
    }).parse(input),
  )
  .handler(async ({ data, context }: any) => {
    const { data: roles } = await context.supabase.from("user_roles_smart_path").select("role").eq("user_id", context.userId);
    const userRoles = (roles ?? []).map((r: any) => r.role as AppRole);
    
    if (userRoles.length === 0) return { hasPermission: false };
    
    const { data: permission } = await supabaseAdmin
      .from("role_permissions" as any)
      .select("enabled")
      .in("role", userRoles)
      .eq("permission", data.permission)
      .eq("enabled", true)
      .maybeSingle();
    
    return { hasPermission: !!permission };
  });

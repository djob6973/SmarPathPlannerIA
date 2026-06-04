import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { AppPermission, AppRole } from "./permissions.types";

export interface AuthState {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  permissions: AppPermission[];
  loading: boolean;
  isAuthenticated: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  hasPermission: (permission: AppPermission) => boolean;
  hasAnyPermission: (permissions: AppPermission[]) => boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
  profile: { full_name: string | null; email: string | null; area_id: string | null } | null;
  areaId: string | null;
  areaName: string | null;
  isSuperAdmin: boolean;
  isAreaAdmin: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [permissions, setPermissions] = useState<AppPermission[]>([]);
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<{ full_name: string | null; email: string | null; area_id: string | null } | null>(null);
  const [areaId, setAreaId] = useState<string | null>(null);
  const [areaName, setAreaName] = useState<string | null>(null);

  const loadProfile = async (uid: string | null) => {
    if (!uid) {
      setProfile(null);
      setAreaId(null);
      setAreaName(null);
      return;
    }
    // Try to select area_id, fallback if it doesn't exist yet
    const { data, error } = await (supabase.from("profiles") as any).select("full_name, email, area_id").eq("id", uid).single();
    if (error) {
      console.error("[auth] loadProfile error:", error.message);
      // Fallback: try without area_id if migration hasn't run yet
      const { data: fallbackData, error: fallbackError } = await supabase.from("profiles").select("full_name, email").eq("id", uid).single();
      if (fallbackError) {
        console.error("[auth] loadProfile fallback error:", fallbackError.message);
        setProfile(null);
        setAreaId(null);
        setAreaName(null);
      } else {
        setProfile({ ...fallbackData, area_id: null } as any);
        setAreaId(null);
        setAreaName(null);
      }
    } else {
      setProfile(data);
      setAreaId(data.area_id);
      
      // Load area name if area_id exists
      if (data.area_id) {
        try {
          const { data: areaData, error: areaError } = await (supabase as any).from("areas").select("name").eq("id", data.area_id).single();
          if (!areaError && areaData) {
            setAreaName(areaData.name);
          } else {
            setAreaName(null);
          }
        } catch (e) {
          // areas table might not exist yet
          setAreaName(null);
        }
      } else {
        setAreaName(null);
      }
    }
  };

  const loadRoles = async (uid: string | null) => {
    if (!uid) {
      setRoles([]);
      setPermissions([]);
      return;
    }
    console.log("[auth] loadRoles uid:", uid);
    const { data, error } = await supabase.from("user_roles_smart_path").select("role").eq("user_id", uid);
    console.log("[auth] loadRoles data:", data, "error:", error);
    if (error) {
      console.error("[auth] loadRoles error:", error.message);
      setRoles([]);
      setPermissions([]);
      return;
    }
    const userRoles = (data ?? []).map((r: any) => {
      // Handle both string and object formats
      if (typeof r === 'object' && r !== null && 'role' in r) {
        return r.role as AppRole;
      }
      return r as AppRole;
    });
    setRoles(userRoles);
    
    // Load permissions based on roles
    if (userRoles.length > 0) {
      const { data: permsData, error: permsError } = await supabase
        .from("role_permissions")
        .select("permission")
        .in("role", userRoles)
        .eq("enabled", true);
      
      if (permsError) {
        console.error("[auth] loadPermissions error:", permsError.message);
        setPermissions([]);
      } else {
        const uniquePermissions = new Set((permsData ?? []).map((p: any) => p.permission as AppPermission));
        setPermissions(Array.from(uniquePermissions));
      }
    } else {
      setPermissions([]);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      // defer to avoid recursion in callback
      setTimeout(() => {
        loadRoles(newSession?.user?.id ?? null);
        loadProfile(newSession?.user?.id ?? null);
      }, 0);
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      Promise.all([
        loadRoles(data.session?.user?.id ?? null),
        loadProfile(data.session?.user?.id ?? null)
      ]).finally(() => setLoading(false));
    });

    return () => subscription.unsubscribe();
  }, []);

  const value: AuthState = {
    user,
    session,
    roles,
    permissions,
    loading,
    isAuthenticated: !!session,
    hasRole: (role) => roles.includes(role),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    hasPermission: (permission) => permissions.includes(permission),
    hasAnyPermission: (perms) => perms.some((p) => permissions.includes(p)),
    signOut: async () => {
      await supabase.auth.signOut();
    },
    refreshRoles: async () => loadRoles(user?.id ?? null),
    refreshPermissions: async () => loadRoles(user?.id ?? null),
    profile,
    areaId,
    areaName,
    isSuperAdmin: roles.includes("super_admin"),
    isAreaAdmin: roles.includes("area_admin"),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
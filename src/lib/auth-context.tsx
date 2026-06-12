import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { getCurrentUser, type CurrentUser } from "./auth.functions";
import type { AppPermission, AppRole } from "./permissions.types";

export interface AuthState {
  // Supabase-compatible shape kept for backwards compatibility
  user: { id: string; email: string } | null;
  session: Record<string, never> | null;
  profile: { full_name: string | null; email: string | null; area_id: string | null } | null;
  roles: AppRole[];
  permissions: AppPermission[];
  loading: boolean;
  isAuthenticated: boolean;
  areaId: string | null;
  areaName: string | null;
  isSuperAdmin: boolean;
  isAreaAdmin: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  hasPermission: (permission: AppPermission) => boolean;
  hasAnyPermission: (permissions: AppPermission[]) => boolean;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
  refreshPermissions: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [userData, setUserData] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const data = await getCurrentUser();
      setUserData(data);
    } catch {
      setUserData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const roles = userData?.roles ?? [];
  const permissions = userData?.permissions ?? [];

  const value: AuthState = {
    user: userData ? { id: userData.id, email: userData.email } : null,
    session: userData ? {} : null,
    profile: userData
      ? { full_name: userData.fullName, email: userData.email, area_id: userData.areaId }
      : null,
    roles,
    permissions,
    loading,
    isAuthenticated: !!userData,
    areaId: userData?.areaId ?? null,
    areaName: userData?.areaName ?? null,
    isSuperAdmin: roles.includes("super_admin"),
    isAreaAdmin: roles.includes("area_admin"),
    hasRole: (role) => roles.includes(role),
    hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
    hasPermission: (p) => permissions.includes(p),
    hasAnyPermission: (ps) => ps.some((p) => permissions.includes(p)),
    signOut: async () => {
      window.location.href = "/oauth2/sign_out";
    },
    refreshRoles: load,
    refreshPermissions: load,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

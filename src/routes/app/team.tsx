import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, setUserRole, assignUserToArea, listAreas, adminResetPassword } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, Building, KeyRound, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/app/team")({
  component: TeamPage,
});

type TeamUser = { id: string; email: string; full_name: string | null; roles: string[]; area_id: string | null };

const ROLES = ["super_admin", "area_admin", "admin", "manager", "client", "viewer"] as const;

const ROLE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  super_admin: { bg: "rgba(237,86,80,.13)", color: "#ED5650", label: "Super Admin" },
  area_admin:  { bg: "rgba(249,115,22,.13)", color: "#F97316", label: "Admin Área" },
  admin:       { bg: "rgba(168,85,247,.13)", color: "#A855F7", label: "Admin" },
  manager:     { bg: "rgba(59,130,246,.13)",  color: "#3B82F6", label: "Manager" },
  client:      { bg: "rgba(157,221,5,.18)",   color: "#7AAE1B", label: "Cliente" },
  viewer:      { bg: "rgba(100,116,139,.13)", color: "#64748B", label: "Viewer" },
};

const AVATAR_PALETTE = [
  "#ED5650", "#3B82F6", "#7AAE1B", "#F97316",
  "#A855F7", "#06B6D4", "#F59E0B", "#10B981",
];

function getRoleKey(r: string): string {
  return (r as any)?.role ?? r;
}

function TeamPage() {
  const { hasRole } = useAuth();
  const list       = useServerFn(listUsers);
  const setRole    = useServerFn(setUserRole);
  const assignArea = useServerFn(assignUserToArea);
  const getAreas   = useServerFn(listAreas);
  const resetPwd   = useServerFn(adminResetPassword);

  const [users, setUsers]             = useState<TeamUser[]>([]);
  const [areas, setAreas]             = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const [resetTarget, setResetTarget] = useState<TeamUser | null>(null);
  const [newPwd, setNewPwd]           = useState("");
  const [confirmPwd, setConfirmPwd]   = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const isAdmin        = hasRole("super_admin");
  const isAreaAdmin    = hasRole("area_admin");
  const canManageAreas = isAdmin || isAreaAdmin;

  const reload = async () => {
    setLoading(true);
    const res = await list();
    setUsers(res.users);
    setLoading(false);
  };

  const loadAreas = async () => {
    try {
      const res = await getAreas();
      setAreas(res.areas || []);
    } catch {}
  };

  useEffect(() => {
    reload();
    loadAreas();
  }, []);

  const toggle = async (userId: string, role: string, enabled: boolean) => {
    try {
      await setRole({ data: { userId, role: role as any, enabled } });
      reload();
      toast.success(`Rol ${role} ${enabled ? "asignado" : "eliminado"}`);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al actualizar rol");
    }
  };

  const handleAreaChange = async (userId: string, areaId: string) => {
    try {
      await assignArea({ data: { userId, areaId: areaId === "none" ? null : areaId } });
      toast.success("Área asignada exitosamente");
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al asignar área");
    }
  };

  const openResetDialog = (user: TeamUser) => {
    setResetTarget(user);
    setNewPwd("");
    setConfirmPwd("");
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetTarget) return;
    if (newPwd !== confirmPwd) { toast.error("Las contraseñas no coinciden"); return; }
    if (newPwd.length < 6) { toast.error("Mínimo 6 caracteres"); return; }
    setResetLoading(true);
    try {
      await resetPwd({ data: { userId: resetTarget.id, newPassword: newPwd } });
      toast.success(`Contraseña de ${resetTarget.full_name ?? resetTarget.email} restablecida`);
      setResetTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? "Error al restablecer contraseña");
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div style={{ padding: "36px 40px 64px", maxWidth: 1180, margin: "0 auto", animation: "spIn .35s ease both" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 32 }}>
        <div style={{
          width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
          background: "rgba(237,86,80,.12)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <Users size={20} style={{ color: "#ED5650" }} />
        </div>
        <div>
          <h1 style={{
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            fontSize: 28, fontWeight: 500,
            color: "var(--foreground)",
            margin: 0, lineHeight: 1.2,
          }}>
            Equipo
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: "4px 0 0" }}>
            {users.length} miembro{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* ── Read-only notice ── */}
      {!canManageAreas && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--muted)", borderRadius: "var(--r-md, 10px)",
          padding: "12px 16px", marginBottom: 24,
          border: "1px solid var(--border)",
        }}>
          <ShieldCheck size={15} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
            Solo los super administradores y administradores de área pueden modificar asignaciones de área.
          </p>
        </div>
      )}

      {/* ── Member cards ── */}
      {loading ? (
        <SkeletonGrid />
      ) : (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
          gap: 16,
        }}>
          {users.map((u, idx) => (
            <MemberCard
              key={u.id}
              user={u}
              idx={idx}
              areas={areas}
              isAdmin={isAdmin}
              canManageAreas={canManageAreas}
              onToggleRole={toggle}
              onAreaChange={handleAreaChange}
              onResetPassword={openResetDialog}
            />
          ))}
        </div>
      )}

      {/* ── Reset password dialog ── */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
          </DialogHeader>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: "0 0 4px" }}>
            Nueva contraseña para{" "}
            <span style={{ fontWeight: 600, color: "var(--foreground)" }}>
              {resetTarget?.full_name ?? resetTarget?.email}
            </span>
          </p>
          <form onSubmit={handleResetPassword} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="reset-pwd">Nueva contraseña</Label>
              <Input
                id="reset-pwd"
                type="password"
                value={newPwd}
                onChange={(e) => setNewPwd(e.target.value)}
                required
                minLength={6}
                autoComplete="new-password"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-confirm">Confirmar contraseña</Label>
              <Input
                id="reset-confirm"
                type="password"
                value={confirmPwd}
                onChange={(e) => setConfirmPwd(e.target.value)}
                required
                autoComplete="new-password"
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResetTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={resetLoading}>
                {resetLoading
                  ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  : "Restablecer"
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── MemberCard ───────────────────────────────────────────────────

interface MemberCardProps {
  user: TeamUser;
  idx: number;
  areas: any[];
  isAdmin: boolean;
  canManageAreas: boolean;
  onToggleRole: (userId: string, role: string, enabled: boolean) => void;
  onAreaChange: (userId: string, areaId: string) => void;
  onResetPassword: (user: TeamUser) => void;
}

function MemberCard({ user: u, idx, areas, isAdmin, canManageAreas, onToggleRole, onAreaChange, onResetPassword }: MemberCardProps) {
  const initials    = (u.full_name ?? u.email).slice(0, 2).toUpperCase();
  const avatarColor = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
  const areaName    = areas.find((a) => a.id === u.area_id)?.name;

  return (
    <div style={{
      background: "var(--card)",
      borderRadius: "var(--r-card, 20px)",
      border: "1px solid var(--border)",
      overflow: "hidden",
    }}>
      {/* Info section */}
      <div style={{ padding: "20px 20px 18px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          {/* Avatar */}
          <div style={{
            width: 44, height: 44, borderRadius: "999px", flexShrink: 0,
            background: avatarColor + "22",
            border: `2px solid ${avatarColor}55`,
            display: "flex", alignItems: "center", justifyContent: "center",
            color: avatarColor,
            fontSize: 14, fontWeight: 700,
          }}>
            {initials}
          </div>
          {/* Name + email */}
          <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
            <p style={{ fontSize: 14.5, fontWeight: 600, color: "var(--foreground)", margin: 0, lineHeight: 1.3 }}>
              {u.full_name ?? "Sin nombre"}
            </p>
            <p style={{
              fontSize: 12.5, color: "var(--muted-foreground)", margin: "3px 0 0",
              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              {u.email}
            </p>
          </div>
        </div>

        {/* Role pills */}
        <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginTop: 14 }}>
          {u.roles.length === 0 ? (
            <span style={{
              padding: "3px 10px", borderRadius: "var(--r-pill, 999px)",
              fontSize: 11, fontWeight: 500,
              background: "var(--muted)", color: "var(--muted-foreground)",
            }}>
              Sin rol
            </span>
          ) : (
            u.roles.map((r) => {
              const rk = getRoleKey(r);
              const rs = ROLE_STYLES[rk];
              return rs ? (
                <span key={rk} style={{
                  display: "inline-flex", alignItems: "center",
                  padding: "3px 10px", borderRadius: "var(--r-pill, 999px)",
                  fontSize: 11, fontWeight: 600,
                  background: rs.bg, color: rs.color,
                }}>
                  {rs.label}
                </span>
              ) : (
                <span key={rk} style={{
                  padding: "3px 10px", borderRadius: "var(--r-pill, 999px)",
                  fontSize: 11, fontWeight: 500,
                  background: "var(--muted)", color: "var(--muted-foreground)",
                }}>
                  {rk}
                </span>
              );
            })
          )}
        </div>

        {/* Area display (viewers / non-admins) */}
        {!canManageAreas && (
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 12 }}>
            <Building size={12} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
            <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Área:</span>
            {areaName ? (
              <span style={{
                fontSize: 12, fontWeight: 500,
                background: "var(--muted)", color: "var(--foreground)",
                borderRadius: "var(--r-pill, 999px)", padding: "2px 9px",
              }}>
                {areaName}
              </span>
            ) : (
              <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>Sin área</span>
            )}
          </div>
        )}
      </div>

      {/* Admin controls */}
      {(isAdmin || canManageAreas) && (
        <div style={{
          borderTop: "1px solid var(--border)",
          background: "var(--muted)",
          padding: "14px 20px",
          display: "flex", flexDirection: "column", gap: 12,
        }}>

          {/* Role toggles */}
          {isAdmin && (
            <div>
              <p style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase" as const,
                letterSpacing: ".07em", color: "var(--muted-foreground)",
                margin: "0 0 8px",
              }}>
                Roles
              </p>
              <div style={{ display: "flex", flexWrap: "wrap" as const, gap: "8px 14px" }}>
                {ROLES.map((role) => {
                  const isActive = u.roles.some((r) => getRoleKey(r) === role);
                  return (
                    <label key={role} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                      <Switch
                        checked={isActive}
                        onCheckedChange={(v) => onToggleRole(u.id, role, v)}
                        className="scale-[0.85]"
                      />
                      <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                        {ROLE_STYLES[role]?.label ?? role}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}

          {/* Area selector */}
          {canManageAreas && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 70 }}>
                <Building size={13} style={{ color: "var(--muted-foreground)" }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>Área</span>
              </div>
              <Select
                value={u.area_id || "none"}
                onValueChange={(value) => onAreaChange(u.id, value)}
              >
                <SelectTrigger style={{ height: 32, fontSize: 12, flex: 1, borderRadius: "var(--r-md, 10px)" }}>
                  <SelectValue placeholder="Sin área" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin área</SelectItem>
                  {areas.map((area) => (
                    <SelectItem key={area.id} value={area.id}>{area.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Reset password */}
          {canManageAreas && (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 5, minWidth: 70 }}>
                <KeyRound size={13} style={{ color: "var(--muted-foreground)" }} />
                <span style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)" }}>Contraseña</span>
              </div>
              <button
                onClick={() => onResetPassword(u)}
                style={{
                  height: 32, padding: "0 14px",
                  borderRadius: "var(--r-md, 10px)",
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                  color: "var(--foreground)",
                  fontSize: 12, cursor: "pointer",
                  whiteSpace: "nowrap" as const,
                }}
              >
                Restablecer
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────

function SkeletonGrid() {
  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
      gap: 16,
    }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} style={{
          background: "var(--card)",
          borderRadius: "var(--r-card, 20px)",
          border: "1px solid var(--border)",
          padding: "20px",
        }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ ...skPulse, width: 44, height: 44, borderRadius: "999px" }} />
            <div style={{ flex: 1, display: "flex", flexDirection: "column" as const, gap: 8, paddingTop: 4 }}>
              <div style={{ ...skPulse, height: 14, width: "55%", borderRadius: 6 }} />
              <div style={{ ...skPulse, height: 12, width: "75%", borderRadius: 6 }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 14 }}>
            <div style={{ ...skPulse, height: 22, width: 72, borderRadius: 999 }} />
            <div style={{ ...skPulse, height: 22, width: 56, borderRadius: 999 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

const skPulse: React.CSSProperties = {
  background: "var(--muted)",
  animation: "pulse 1.5s ease-in-out infinite",
};

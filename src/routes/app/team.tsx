import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, setUserRole, assignUserToArea, listAreas, adminResetPassword, updateUserProfile } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, KeyRound, ShieldCheck, Pencil, Search, Trash2 } from "lucide-react";

export const Route = createFileRoute("/app/team")({
  component: TeamPage,
});

type TeamUser = {
  id: string;
  email: string;
  full_name: string | null;
  roles: string[];
  area_id: string | null;
  created_at?: string;
};

const ROLES = ["super_admin", "area_admin", "manager", "agent", "client", "viewer"] as const;

const ROLE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  super_admin: { bg: "rgba(237,86,80,.15)",   color: "#ED5650", label: "Super Admin" },
  area_admin:  { bg: "rgba(249,115,22,.15)",  color: "#F97316", label: "Admin Área" },
  manager:     { bg: "rgba(59,130,246,.15)",   color: "#3B82F6", label: "Manager" },
  agent:       { bg: "rgba(168,85,247,.15)",   color: "#A855F7", label: "Agente" },
  client:      { bg: "rgba(6,182,212,.15)",    color: "#06B6D4", label: "Participante" },
  viewer:      { bg: "rgba(100,116,139,.15)",  color: "#94A3B8", label: "Viewer" },
};

const AVATAR_PALETTE = [
  "#ED5650", "#3B82F6", "#7AAE1B", "#F97316",
  "#A855F7", "#06B6D4", "#F59E0B", "#10B981",
];

function getRoleKey(r: string): string {
  return (r as any)?.role ?? r;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es", { month: "short", day: "numeric" });
}

// ── Icon button shared style ──────────────────────────────────────
const iconBtn: React.CSSProperties = {
  width: 30, height: 30,
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  display: "flex", alignItems: "center", justifyContent: "center",
  cursor: "pointer",
  color: "var(--muted-foreground)",
  transition: "background .15s, color .15s",
};

// ── Skeleton pulse ────────────────────────────────────────────────
const skPulse: React.CSSProperties = {
  background: "var(--muted)",
  animation: "pulse 1.5s ease-in-out infinite",
};

// ── TeamPage ──────────────────────────────────────────────────────
function TeamPage() {
  const { hasPermission } = useAuth();

  if (!hasPermission("view_team")) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Sin acceso</p>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>No tienes permiso para ver el módulo de equipo.</p>
      </div>
    );
  }

  const list        = useServerFn(listUsers);
  const setRole     = useServerFn(setUserRole);
  const assignArea  = useServerFn(assignUserToArea);
  const getAreas    = useServerFn(listAreas);
  const resetPwd    = useServerFn(adminResetPassword);
  const editProfile = useServerFn(updateUserProfile);

  const [users, setUsers]               = useState<TeamUser[]>([]);
  const [areas, setAreas]               = useState<any[]>([]);
  const [loading, setLoading]           = useState(true);
  const [search, setSearch]             = useState("");

  // edit dialog
  const [editTarget, setEditTarget]     = useState<TeamUser | null>(null);
  const [editName, setEditName]         = useState("");
  const [editEmail, setEditEmail]       = useState("");
  const [editLoading, setEditLoading]   = useState(false);

  // reset password dialog
  const [resetTarget, setResetTarget]   = useState<TeamUser | null>(null);
  const [newPwd, setNewPwd]             = useState("");
  const [confirmPwd, setConfirmPwd]     = useState("");
  const [resetLoading, setResetLoading] = useState(false);

  const canManageRoles = hasPermission("manage_roles");
  const canManageUsers = hasPermission("manage_users");

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

  const handleToggleRole = async (userId: string, role: string, enabled: boolean) => {
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

  const openEditDialog = (user: TeamUser) => {
    setEditTarget(user);
    setEditName(user.full_name ?? "");
    setEditEmail(user.email);
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editName.trim()) { toast.error("El nombre es obligatorio"); return; }
    if (!editEmail.trim()) { toast.error("El email es obligatorio"); return; }
    setEditLoading(true);
    try {
      await editProfile({ data: { userId: editTarget.id, full_name: editName.trim(), email: editEmail.trim() } });
      toast.success("Perfil actualizado");
      setEditTarget(null);
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? "Error al actualizar perfil");
    } finally {
      setEditLoading(false);
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

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) =>
        (u.full_name ?? "").toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      )
    : users;

  return (
    <div style={{ padding: "36px 40px 64px", maxWidth: 1180, margin: "0 auto", animation: "spIn .35s ease both" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 28 }}>
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
      {!canManageUsers && (
        <div style={{
          display: "flex", alignItems: "center", gap: 10,
          background: "var(--muted)", borderRadius: 10,
          padding: "12px 16px", marginBottom: 20,
          border: "1px solid var(--border)",
        }}>
          <ShieldCheck size={15} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
            Solo los super administradores y administradores de área pueden modificar asignaciones.
          </p>
        </div>
      )}

      {/* ── Search ── */}
      <div style={{ position: "relative", marginBottom: 20, maxWidth: 340 }}>
        <Search size={14} style={{
          position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)",
          color: "var(--muted-foreground)", pointerEvents: "none",
        }} />
        <input
          type="text"
          placeholder="Buscar usuarios..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: "100%", height: 38, paddingLeft: 34, paddingRight: 12,
            background: "var(--card)", border: "1px solid var(--border)",
            borderRadius: 10, color: "var(--foreground)",
            fontSize: 13, outline: "none", fontFamily: "inherit",
          }}
        />
      </div>

      {/* ── Table ── */}
      {loading ? (
        <SkeletonTable />
      ) : filtered.length === 0 ? (
        <div style={{
          background: "var(--card)", border: "1px solid var(--border)",
          borderRadius: 16, padding: "56px 20px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
        }}>
          <Users size={28} style={{ color: "var(--muted-foreground)", opacity: .4 }} />
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: 0 }}>
            {search ? "Sin resultados para esa búsqueda" : "No hay miembros registrados"}
          </p>
        </div>
      ) : (
        <div style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 16,
          overflow: "hidden",
        }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {(["USUARIO", "ROL", "ÁREA", "EVALUACIONES", "INGRESO", "ACCIONES"] as const).map((col) => (
                  <th key={col} style={{
                    padding: "13px 20px",
                    textAlign: "left",
                    fontSize: 11, fontWeight: 700, letterSpacing: ".08em",
                    color: "var(--muted-foreground)",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    borderBottom: "1px solid var(--border)",
                    background: "transparent",
                  }}>
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, idx) => {
                const areaName    = areas.find((a) => a.id === u.area_id)?.name;
                const initials    = (u.full_name ?? u.email).slice(0, 2).toUpperCase();
                const avatarColor = AVATAR_PALETTE[idx % AVATAR_PALETTE.length];
                const primaryRole = u.roles.length > 0 ? getRoleKey(u.roles[0]) : null;
                const rs          = primaryRole ? ROLE_STYLES[primaryRole] : null;
                const isLast      = idx === filtered.length - 1;

                return (
                  <tr key={u.id} style={{ borderBottom: isLast ? "none" : "1px solid var(--border)" }}>

                    {/* USUARIO */}
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                          background: avatarColor + "22",
                          border: `1.5px solid ${avatarColor}44`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: avatarColor, fontSize: 12, fontWeight: 700,
                        }}>
                          {initials}
                        </div>
                        <div>
                          <p style={{ fontSize: 13.5, fontWeight: 600, color: "var(--foreground)", margin: 0, lineHeight: 1.3 }}>
                            {u.full_name ?? "Sin nombre"}
                          </p>
                          <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
                            {u.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* ROL */}
                    <td style={{ padding: "14px 20px" }}>
                      {rs ? (
                        <span style={{
                          display: "inline-flex", alignItems: "center",
                          padding: "4px 12px", borderRadius: 999,
                          fontSize: 11, fontWeight: 700, letterSpacing: ".05em",
                          textTransform: "uppercase",
                          background: rs.bg, color: rs.color,
                        }}>
                          {rs.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Sin rol</span>
                      )}
                    </td>

                    {/* ÁREA */}
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ fontSize: 13, color: areaName ? "var(--foreground)" : "var(--muted-foreground)" }}>
                        {areaName ?? "—"}
                      </span>
                    </td>

                    {/* EVALUACIONES */}
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ fontSize: 13, color: "var(--foreground)" }}>
                        {u.roles.length}
                      </span>
                    </td>

                    {/* INGRESO */}
                    <td style={{ padding: "14px 20px" }}>
                      <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                        {formatDate(u.created_at)}
                      </span>
                    </td>

                    {/* ACCIONES */}
                    <td style={{ padding: "14px 20px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {canManageUsers && (
                          <button
                            onClick={() => openEditDialog(u)}
                            title="Editar miembro"
                            style={iconBtn}
                          >
                            <Pencil size={14} />
                          </button>
                        )}
                        {canManageUsers && (
                          <button
                            onClick={() => openResetDialog(u)}
                            title="Restablecer contraseña"
                            style={iconBtn}
                          >
                            <KeyRound size={14} />
                          </button>
                        )}
                        {canManageUsers && (
                          <button
                            title="Eliminar usuario"
                            style={{ ...iconBtn, color: "rgba(237,86,80,.6)" }}
                            onClick={() => toast.info("Función próximamente disponible")}
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Edit dialog (profile + roles + área) ── */}
      <Dialog open={!!editTarget} onOpenChange={(open) => !open && setEditTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar miembro</DialogTitle>
          </DialogHeader>

          {editTarget && (() => {
            const eidx    = users.findIndex((u) => u.id === editTarget.id);
            const color   = AVATAR_PALETTE[(eidx >= 0 ? eidx : 0) % AVATAR_PALETTE.length];
            const initials = (editTarget.full_name ?? editTarget.email).slice(0, 2).toUpperCase();
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 8 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: "50%", flexShrink: 0,
                  background: color + "22", border: `2px solid ${color}44`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color, fontSize: 13, fontWeight: 700,
                }}>
                  {initials}
                </div>
                <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>
                  Actualiza el perfil, roles y área del miembro.
                </p>
              </div>
            );
          })()}

          <form onSubmit={handleEditProfile} className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Nombre completo</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nombre completo"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-email">Email</Label>
              <Input
                id="edit-email"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
                placeholder="email@ejemplo.com"
                required
              />
            </div>

            {/* Roles */}
            {canManageRoles && editTarget && (
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <Select
                  value={editTarget.roles.length > 0 ? getRoleKey(editTarget.roles[0]) : "none"}
                  onValueChange={(value) => {
                    const current = editTarget.roles.length > 0 ? getRoleKey(editTarget.roles[0]) : null;
                    if (current && current !== value) handleToggleRole(editTarget.id, current, false);
                    if (value !== "none") handleToggleRole(editTarget.id, value, true);
                    setEditTarget((prev) => prev ? { ...prev, roles: value === "none" ? [] : [value] } : prev);
                  }}
                >
                  <SelectTrigger style={{ fontSize: 13 }}>
                    <SelectValue placeholder="Seleccionar rol" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin rol</SelectItem>
                    {ROLES.map((role) => (
                      <SelectItem key={role} value={role}>
                        {ROLE_STYLES[role]?.label ?? role}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Área */}
            {canManageUsers && (
              <div className="space-y-1.5">
                <Label>Área</Label>
                <Select
                  value={editTarget?.area_id || "none"}
                  onValueChange={(value) => {
                    if (!editTarget) return;
                    handleAreaChange(editTarget.id, value);
                    setEditTarget((prev) => prev ? { ...prev, area_id: value === "none" ? null : value } : prev);
                  }}
                >
                  <SelectTrigger style={{ fontSize: 13 }}>
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

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={editLoading}>
                {editLoading
                  ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  : "Guardar"
                }
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

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

// ── Skeleton Table ────────────────────────────────────────────────

function SkeletonTable() {
  return (
    <div style={{
      background: "var(--card)",
      border: "1px solid var(--border)",
      borderRadius: 16,
      overflow: "hidden",
    }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {["USUARIO", "ROL", "ÁREA", "EVALUACIONES", "INGRESO", "ACCIONES"].map((col) => (
              <th key={col} style={{
                padding: "13px 20px",
                textAlign: "left",
                fontSize: 11, fontWeight: 700, letterSpacing: ".08em",
                color: "var(--muted-foreground)",
                textTransform: "uppercase",
                borderBottom: "1px solid var(--border)",
              }}>
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i} style={{ borderBottom: i < 4 ? "1px solid var(--border)" : "none" }}>
              <td style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ ...skPulse, width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <div style={{ ...skPulse, height: 13, width: 120, borderRadius: 6 }} />
                    <div style={{ ...skPulse, height: 11, width: 160, borderRadius: 6 }} />
                  </div>
                </div>
              </td>
              <td style={{ padding: "14px 20px" }}>
                <div style={{ ...skPulse, height: 22, width: 80, borderRadius: 999 }} />
              </td>
              <td style={{ padding: "14px 20px" }}>
                <div style={{ ...skPulse, height: 13, width: 70, borderRadius: 6 }} />
              </td>
              <td style={{ padding: "14px 20px" }}>
                <div style={{ ...skPulse, height: 13, width: 24, borderRadius: 6 }} />
              </td>
              <td style={{ padding: "14px 20px" }}>
                <div style={{ ...skPulse, height: 13, width: 48, borderRadius: 6 }} />
              </td>
              <td style={{ padding: "14px 20px" }}>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map((j) => (
                    <div key={j} style={{ ...skPulse, width: 30, height: 30, borderRadius: 8 }} />
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

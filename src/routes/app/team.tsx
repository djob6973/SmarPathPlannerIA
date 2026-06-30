import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, setUserRole, assignUserToArea, listAreas, adminResetPassword, updateUserProfile } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Users, KeyRound, ShieldCheck, Pencil, Search, Trash2, X } from "lucide-react";

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
  is_active?: boolean;
};

const ROLES = ["super_admin", "area_admin", "manager", "agent", "client", "viewer"] as const;

const ROLE_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  super_admin: { bg: "#F5F5F5", color: "rgba(51,51,51,0.65)", label: "Super Admin" },
  area_admin:  { bg: "#F5F5F5", color: "rgba(51,51,51,0.65)", label: "Admin Área" },
  manager:     { bg: "#F5F5F5", color: "rgba(51,51,51,0.65)", label: "Manager" },
  agent:       { bg: "#F5F5F5", color: "rgba(51,51,51,0.65)", label: "Agente" },
  client:      { bg: "#F5F5F5", color: "rgba(51,51,51,0.65)", label: "Participante" },
  viewer:      { bg: "#F5F5F5", color: "rgba(51,51,51,0.65)", label: "Viewer" },
};

const AVATAR_COLOR = "#ED5650";

function getRoleKey(r: string): string {
  return (r as any)?.role ?? r;
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("es", { month: "short", day: "numeric" });
}

// ── Dialog field styles ───────────────────────────────────────────
const dlLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, letterSpacing: ".08em",
  textTransform: "uppercase", color: "var(--muted-foreground)",
};

const dlInput: React.CSSProperties = {
  height: 42, borderRadius: 10,
  background: "#ffffff", border: "1px solid var(--border)",
  fontSize: 13,
};

// ── Icon button shared style ──────────────────────────────────────
const iconBtn: React.CSSProperties = {
  width: 30, height: 30,
  borderRadius: 8,
  border: "none",
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
  const { t } = useLang();

  if (!hasPermission("view_team")) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{t("common.noAccess")}</p>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{t("team.noPermission")}</p>
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
  const [editActive, setEditActive]     = useState(true);
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
      toast.success(enabled ? t("team.roleAssigned", { role }) : t("team.roleRemoved", { role }));
    } catch (e: any) {
      toast.error(e?.message ?? t("team.roleError"));
    }
  };

  const handleAreaChange = async (userId: string, areaId: string) => {
    try {
      await assignArea({ data: { userId, areaId: areaId === "none" ? null : areaId } });
      toast.success(t("team.areaAssigned"));
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? t("team.areaError"));
    }
  };

  const openEditDialog = (user: TeamUser) => {
    setEditTarget(user);
    setEditName(user.full_name ?? "");
    setEditEmail(user.email);
    setEditActive(user.is_active !== false);
  };

  const handleEditProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    if (!editName.trim()) { toast.error(t("team.nameRequired")); return; }
    if (!editEmail.trim()) { toast.error(t("team.emailRequired")); return; }
    setEditLoading(true);
    try {
      await editProfile({ data: { userId: editTarget.id, full_name: editName.trim(), email: editEmail.trim(), is_active: editActive } });
      toast.success(t("team.profileUpdated"));
      setEditTarget(null);
      reload();
    } catch (e: any) {
      toast.error(e?.message ?? t("team.profileError"));
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
    if (newPwd !== confirmPwd) { toast.error(t("team.pwdMismatch")); return; }
    if (newPwd.length < 6) { toast.error(t("team.pwdMinLength")); return; }
    setResetLoading(true);
    try {
      await resetPwd({ data: { userId: resetTarget.id, newPassword: newPwd } });
      toast.success(t("team.pwdReset", { name: resetTarget.full_name ?? resetTarget.email }));
      setResetTarget(null);
    } catch (e: any) {
      toast.error(e?.message ?? t("team.pwdResetError"));
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
            {t("team.title")}
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", margin: "4px 0 0" }}>
            {users.length === 1 ? t("team.memberCount_one", { n: 1 }) : t("team.memberCount_other", { n: users.length })}
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
            {t("team.readOnlyNotice")}
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
          placeholder={t("team.searchPlaceholder")}
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
                const avatarColor = AVATAR_COLOR;
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
                            {u.full_name ?? t("common.noName")}
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
                        <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{t("nav.noRole")}</span>
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

      {/* ── Edit modal (portal → renders at body level) ── */}
      {editTarget && createPortal(
        <div
          style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", background: "rgba(0,0,0,.45)", zIndex: 9998, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}
          onClick={(e) => e.target === e.currentTarget && setEditTarget(null)}
        >
          <div style={{
            width: "100%", maxWidth: 420,
            background: "var(--card)",
            border: "1px solid var(--border)",
            borderRadius: 16,
            overflow: "hidden",
            boxShadow: "0 20px 60px rgba(0,0,0,.18)",
            zIndex: 9999, position: "relative",
          }}>

            {/* Header */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "22px 24px 18px",
              borderBottom: "1px solid var(--border)",
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                Editar usuario
              </h3>
              <button
                type="button"
                onClick={() => setEditTarget(null)}
                style={{
                  width: 30, height: 30, borderRadius: 8, border: "none",
                  background: "transparent", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "var(--muted-foreground)",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--secondary)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <form onSubmit={handleEditProfile}>
              <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Nombre */}
                <EditField label="NOMBRE COMPLETO">
                  <input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="Nombre completo"
                    required
                    style={{
                      width: "100%", height: 42, borderRadius: 10,
                      background: "#ffffff", border: "1px solid var(--border)",
                      color: "var(--foreground)", fontSize: 13,
                      padding: "0 12px", outline: "none", fontFamily: "inherit",
                      boxSizing: "border-box",
                    }}
                  />
                </EditField>

                {/* Rol */}
                {canManageRoles && (() => {
                  const rk = editTarget.roles.length > 0 ? getRoleKey(editTarget.roles[0]) : "none";
                  const rs = rk !== "none" ? ROLE_STYLES[rk] : null;
                  return (
                    <EditField label="ROL">
                      <div style={{ position: "relative" }}>
                        <div style={{
                          display: "flex", alignItems: "center", justifyContent: "space-between",
                          height: 42, borderRadius: 10, padding: "0 12px",
                          background: "#ffffff", border: "1px solid var(--border)",
                          pointerEvents: "none",
                        }}>
                          {rs ? (
                            <span style={{
                              display: "inline-flex", alignItems: "center",
                              padding: "3px 10px", borderRadius: 999,
                              fontSize: 11, fontWeight: 700, letterSpacing: ".05em",
                              textTransform: "uppercase",
                              background: rs.bg, color: rs.color,
                            }}>
                              {rs.label}
                            </span>
                          ) : (
                            <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Seleccionar rol</span>
                          )}
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--muted-foreground)", flexShrink: 0 }}><path d="m6 9 6 6 6-6"/></svg>
                        </div>
                        <select
                          value={rk}
                          onChange={(e) => {
                            const value = e.target.value;
                            const current = editTarget.roles.length > 0 ? getRoleKey(editTarget.roles[0]) : null;
                            if (current && current !== value) handleToggleRole(editTarget.id, current, false);
                            if (value !== "none") handleToggleRole(editTarget.id, value, true);
                            setEditTarget((prev) => prev ? { ...prev, roles: value === "none" ? [] : [value] } : prev);
                          }}
                          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                        >
                          <option value="none">Sin rol</option>
                          {ROLES.map((role) => (
                            <option key={role} value={role}>{ROLE_STYLES[role]?.label ?? role}</option>
                          ))}
                        </select>
                      </div>
                    </EditField>
                  );
                })()}

                {/* Área */}
                {canManageUsers && (
                  <EditField label="ÁREA">
                    <div style={{ position: "relative" }}>
                      <div style={{
                        display: "flex", alignItems: "center", justifyContent: "space-between",
                        height: 42, borderRadius: 10, padding: "0 12px",
                        background: "#ffffff", border: "1px solid var(--border)",
                        pointerEvents: "none",
                      }}>
                        <span style={{ fontSize: 13, color: editTarget.area_id ? "var(--foreground)" : "var(--muted-foreground)" }}>
                          {areas.find((a) => a.id === editTarget.area_id)?.name ?? "Sin área"}
                        </span>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "var(--muted-foreground)", flexShrink: 0 }}><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                      <select
                        value={editTarget.area_id || "none"}
                        onChange={(e) => {
                          const value = e.target.value;
                          handleAreaChange(editTarget.id, value);
                          setEditTarget((prev) => prev ? { ...prev, area_id: value === "none" ? null : value } : prev);
                        }}
                        style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity: 0, cursor: "pointer" }}
                      >
                        <option value="none">Sin área</option>
                        {areas.map((area) => (
                          <option key={area.id} value={area.id}>{area.name}</option>
                        ))}
                      </select>
                    </div>
                  </EditField>
                )}

                {/* Estado de la cuenta */}
                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  background: "#ffffff", border: "1px solid var(--border)",
                  borderRadius: 10, padding: "14px 16px",
                }}>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>
                      Estado de la cuenta
                    </p>
                    <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "2px 0 0" }}>
                      {editActive ? "El usuario puede iniciar sesión" : "El usuario no puede iniciar sesión"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditActive((v) => !v)}
                    style={{
                      display: "flex", alignItems: "center", gap: 5,
                      fontSize: 12, fontWeight: 600,
                      color: editActive ? "rgb(5,150,105)" : "var(--muted-foreground)",
                      background: editActive ? "rgba(16,185,129,.15)" : "var(--border)",
                      border: "none", borderRadius: 999,
                      padding: "5px 11px", cursor: "pointer", flexShrink: 0,
                    }}
                  >
                    <span style={{
                      width: 7, height: 7, borderRadius: "50%", flexShrink: 0,
                      background: editActive ? "rgb(16,185,129)" : "var(--muted-foreground)",
                    }} />
                    {editActive ? "Activo" : "Inactivo"}
                  </button>
                </div>

              </div>

              {/* Footer */}
              <div style={{ display: "flex", gap: 10, padding: "4px 24px 24px" }}>
                <button
                  type="button"
                  onClick={() => setEditTarget(null)}
                  style={{
                    flex: 1, height: 42, borderRadius: 999,
                    border: "1px solid var(--border)",
                    background: "var(--background)",
                    color: "var(--foreground)",
                    fontSize: 14, fontWeight: 500, cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={editLoading}
                  style={{
                    flex: 1, height: 42, borderRadius: 999,
                    border: "none", background: "#ED5650", color: "#fff",
                    fontSize: 14, fontWeight: 600, cursor: editLoading ? "not-allowed" : "pointer",
                    fontFamily: "inherit", opacity: editLoading ? .7 : 1,
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                  onMouseEnter={(e) => { if (!editLoading) e.currentTarget.style.background = "#d94d47"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = editLoading ? "#ED5650" : "#ED5650"; }}
                >
                  {editLoading
                    ? <span style={{ width: 14, height: 14, borderRadius: "50%", border: "2px solid #fff", borderTopColor: "transparent", animation: "spin 0.7s linear infinite", display: "inline-block" }} />
                    : "Guardar"
                  }
                </button>
              </div>
            </form>
          </div>
        </div>,
        document.body
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

// ── EditField helper ─────────────────────────────────────────────
function EditField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" as const, color: "#6B7280" }}>
        {label}
      </label>
      {children}
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

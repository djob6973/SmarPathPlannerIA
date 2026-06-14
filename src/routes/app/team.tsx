import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { listUsers, setUserRole, assignUserToArea, listAreas, adminResetPassword } from "@/lib/admin.functions";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Users, ShieldCheck, Building, KeyRound } from "lucide-react";

export const Route = createFileRoute("/app/team")({
  component: TeamPage,
});

type TeamUser = { id: string; email: string; full_name: string | null; roles: string[]; area_id: string | null };

const ROLES = ["super_admin", "area_admin", "admin", "manager", "client", "viewer"] as const;
const ROLE_COLOR: Record<string, string> = {
  super_admin: "bg-red-500/15 text-red-400 border-red-500/30",
  area_admin: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  admin:   "bg-purple-500/15 text-purple-400 border-purple-500/30",
  manager: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  client:  "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  viewer:  "bg-slate-500/15 text-slate-400 border-slate-500/30",
};

function TeamPage() {
  const { hasRole } = useAuth();
  const list = useServerFn(listUsers);
  const setRole = useServerFn(setUserRole);
  const assignArea = useServerFn(assignUserToArea);
  const getAreas = useServerFn(listAreas);
  const resetPwd = useServerFn(adminResetPassword);
  const [users, setUsers] = useState<TeamUser[]>([]);
  const [areas, setAreas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetTarget, setResetTarget] = useState<TeamUser | null>(null);
  const [newPwd, setNewPwd] = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const isAdmin = hasRole("super_admin");
  const isAreaAdmin = hasRole("area_admin");
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
    } catch (e) {
      console.error("Error loading areas:", e);
    }
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
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Equipo</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {users.length} miembro{users.length !== 1 ? "s" : ""} registrado{users.length !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {!canManageAreas && (
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0" />
          Solo los super administradores y administradores de área pueden modificar asignaciones de área.
        </div>
      )}

      {/* Users grid */}
      <div className="space-y-3">
        {loading && Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="p-4 border-border/50">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full animate-pulse bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-muted" />
                <div className="h-3 w-48 animate-pulse rounded bg-muted" />
              </div>
            </div>
          </Card>
        ))}

        {!loading && users.map((u) => {
          const initials = (u.full_name ?? u.email).slice(0, 2).toUpperCase();
          return (
            <Card key={u.id} className="border-border/50">
              <div className="flex flex-col gap-4 p-4">
                {/* User info */}
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback className="bg-primary/15 text-primary font-semibold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{u.full_name ?? "Sin nombre"}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {u.roles.map((r) => {
                      const roleString = typeof r === 'object' && r !== null ? r.role : r;
                      return (
                        <Badge key={roleString} className={`text-[10px] px-1.5 py-0 border ${ROLE_COLOR[roleString]}`}>
                          {roleString}
                        </Badge>
                      );
                    })}
                    {u.roles.length === 0 && (
                      <span className="text-xs text-muted-foreground">sin rol</span>
                    )}
                  </div>
                </div>

                {/* Actions section */}
                <div className="flex flex-col gap-3 border-t border-border/50 pt-3">
                  {/* Role toggles (admin only) */}
                  {isAdmin && (
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="text-xs font-medium text-muted-foreground">Roles:</span>
                      <div className="flex flex-wrap items-center gap-3">
                        {ROLES.map((role) => (
                          <div key={role} className="flex items-center gap-1.5">
                            <Switch
                              checked={u.roles.includes(role)}
                              onCheckedChange={(v) => toggle(u.id, role, v)}
                              className="scale-90"
                            />
                            <span className="text-xs capitalize text-muted-foreground">{role}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Area selector (super_admin and area_admin only) */}
                  {canManageAreas && (
                    <div className="flex flex-wrap items-center gap-3">
                      <div className="flex items-center gap-2">
                        <Building className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Área:</span>
                      </div>
                      <Select
                        value={u.area_id || "none"}
                        onValueChange={(value) => handleAreaChange(u.id, value)}
                      >
                        <SelectTrigger className="w-48 h-8 text-xs">
                          <SelectValue placeholder="Sin área" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Sin área</SelectItem>
                          {areas.map((area) => (
                            <SelectItem key={area.id} value={area.id}>
                              {area.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Reset password (admins only) */}
                  {canManageAreas && (
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-medium text-muted-foreground">Contraseña:</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs"
                        onClick={() => openResetDialog(u)}
                      >
                        Restablecer
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Reset password dialog */}
      <Dialog open={!!resetTarget} onOpenChange={(open) => !open && setResetTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Restablecer contraseña</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Establecer nueva contraseña para{" "}
            <span className="font-medium text-foreground">
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

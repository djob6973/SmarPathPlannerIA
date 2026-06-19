import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRolePermissions, updateRolePermission, resetRolePermissions } from "@/lib/permissions.functions";
import { PERMISSION_GROUPS, PERMISSION_LABELS, ROLE_LABELS, type AppRole, type AppPermission, type RolePermission } from "@/lib/permissions.types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, RefreshCw, Shield, Save } from "lucide-react";
import { toast } from "sonner";

export function PermissionsManager() {
  const queryClient = useQueryClient();
  const [selectedRole, setSelectedRole] = useState<AppRole>("super_admin");
  const [localPermissions, setLocalPermissions] = useState<Record<string, boolean>>({});
  const [hasChanges, setHasChanges] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const { data: permissionsData, isLoading, error } = useQuery({
    queryKey: ["rolePermissions"],
    queryFn: () => getRolePermissions(),
  });

  useEffect(() => {
    if (permissionsData?.permissions) {
      const rolePerms = permissionsData.permissions.filter((p: any) => p.role === selectedRole);
      const permsMap: Record<string, boolean> = {};
      rolePerms.forEach((p: any) => {
        permsMap[p.permission] = p.enabled;
      });
      setLocalPermissions(permsMap);
      setHasChanges(false);
    }
  }, [permissionsData, selectedRole]);

  const handleTogglePermission = async (permission: AppPermission, enabled: boolean) => {
    setLocalPermissions((prev) => ({ ...prev, [permission]: enabled }));
    setHasChanges(true);
    setIsUpdating(true);
    try {
      await updateRolePermission({ data: { role: selectedRole, permission, enabled } });
      queryClient.invalidateQueries({ queryKey: ["rolePermissions"] });
      toast.success("El permiso se ha actualizado correctamente");
    } catch (error: any) {
      console.error("[PermissionsManager] Error updating permission:", error);
      toast.error(`No se pudo actualizar el permiso: ${error.message || "Error desconocido"}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetRole = async () => {
    if (confirm(`¿Estás seguro de que quieres restablecer los permisos del rol ${ROLE_LABELS[selectedRole]} a los valores predeterminados?`)) {
      setIsUpdating(true);
      try {
        await resetRolePermissions({ data: { role: selectedRole } });
        queryClient.invalidateQueries({ queryKey: ["rolePermissions"] });
        toast.success("Los permisos se han restablecidos a los valores predeterminados");
      } catch (error: any) {
        console.error("[PermissionsManager] Error resetting permissions:", error);
        toast.error("No se pudieron restablecer los permisos");
      } finally {
        setIsUpdating(false);
      }
    }
  };

  const handleSaveAll = async () => {
    const updates = Object.entries(localPermissions)
      .filter(([_, enabled]) => enabled !== undefined)
      .map(([permission, enabled]) => ({ role: selectedRole, permission: permission as AppPermission, enabled }));
    
    setIsUpdating(true);
    try {
      await Promise.all(updates.map((update) => updateRolePermission({ data: update })));
      setHasChanges(false);
      queryClient.invalidateQueries({ queryKey: ["rolePermissions"] });
      toast.success("Todos los permisos se han actualizado correctamente");
    } catch (error: any) {
      console.error("[PermissionsManager] Error saving permissions:", error);
      toast.error("No se pudieron guardar todos los cambios");
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>Error al cargar los permisos. Por favor, intenta nuevamente.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Permisos</h2>
          <p className="text-muted-foreground">Configura los permisos para cada rol del sistema</p>
        </div>
        {hasChanges && (
          <Button onClick={handleSaveAll} size="sm">
            <Save className="h-4 w-4 mr-2" />
            Guardar cambios
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Configuración de Roles
          </CardTitle>
          <CardDescription>Selecciona un rol para ver y editar sus permisos</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2 mb-6">
            {(["super_admin", "area_admin", "manager", "agent", "client", "viewer"] as AppRole[]).map((role) => (
              <Button
                key={role}
                variant={selectedRole === role ? "default" : "outline"}
                onClick={() => setSelectedRole(role)}
                className="flex items-center gap-2"
              >
                {ROLE_LABELS[role]}
                {selectedRole === role && <Badge variant="secondary" className="ml-1">Activo</Badge>}
              </Button>
            ))}
          </div>

          <div className="space-y-6">
            {PERMISSION_GROUPS.map((group) => (
              <div key={group.name} className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold">{group.name}</h3>
                    <p className="text-sm text-muted-foreground">{group.description}</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const allEnabled = group.permissions.every((p) => localPermissions[p] !== false);
                      group.permissions.forEach((p) => handleTogglePermission(p, !allEnabled));
                    }}
                  >
                    {group.permissions.every((p) => localPermissions[p] !== false) ? "Desactivar todos" : "Activar todos"}
                  </Button>
                </div>
                <div className="grid gap-3 pl-4 border-l-2 border-muted">
                  {group.permissions.map((permission) => (
                    <div key={permission} className="flex items-center justify-between py-2">
                      <span className="text-sm">{PERMISSION_LABELS[permission]}</span>
                      <Switch
                        checked={localPermissions[permission] !== false}
                        onCheckedChange={(enabled) => handleTogglePermission(permission, enabled)}
                        disabled={isUpdating}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t">
            <Button
              variant="outline"
              onClick={handleResetRole}
              disabled={isUpdating}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${isUpdating ? "animate-spin" : ""}`} />
              Restablecer permisos predeterminados
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Resumen de Permisos</CardTitle>
          <CardDescription>Vista general de permisos por rol</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {(["super_admin", "area_admin", "manager", "agent", "client", "viewer"] as AppRole[]).map((role) => {
              const rolePerms = permissionsData?.permissions?.filter((p: any) => p.role === role && p.enabled) || [];
              return (
                <div key={role} className="flex items-start gap-3">
                  <Badge variant={role === "super_admin" ? "default" : role === "area_admin" ? "secondary" : "outline"}>
                    {ROLE_LABELS[role]}
                  </Badge>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">{rolePerms.length} permisos activos</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

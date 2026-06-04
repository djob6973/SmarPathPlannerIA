import { useState } from "react";
import { assignSuperAdminToCurrentUser } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function AssignSuperAdmin() {
  const [isAssigning, setIsAssigning] = useState(false);

  const handleAssign = async () => {
    setIsAssigning(true);
    try {
      await assignSuperAdminToCurrentUser({ data: {} });
      toast.success("Rol super_admin asignado exitosamente. Por favor, recarga la página.");
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (error: any) {
      console.error("[AssignSuperAdmin] Error:", error);
      toast.error(`Error al asignar rol: ${error.message || "Error desconocido"}`);
    } finally {
      setIsAssigning(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6">
      <Card className="max-w-md w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Asignar Rol Super Admin
          </CardTitle>
          <CardDescription>
            Si no tienes acceso a la configuración, asigna el rol super_admin a tu cuenta.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertDescription>
              Esta acción te dará acceso completo a todas las áreas y funcionalidades de administración.
            </AlertDescription>
          </Alert>
          <Button 
            onClick={handleAssign} 
            disabled={isAssigning}
            className="w-full"
          >
            {isAssigning ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Asignando...
              </>
            ) : (
              "Asignar Rol Super Admin"
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

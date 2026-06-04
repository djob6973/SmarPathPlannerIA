import { useState } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { listAreas, createArea, updateArea, deleteArea, type Area } from "@/lib/admin.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, Plus, Edit2, Trash2, Building } from "lucide-react";
import { toast } from "sonner";

export function AreasManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [formData, setFormData] = useState({ name: "", description: "" });

  const { data: areasData, isLoading, error } = useQuery({
    queryKey: ["areas"],
    queryFn: () => listAreas(),
  });

  const createMutation = useMutation({
    mutationFn: createArea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      toast.success("Área creada exitosamente");
      setIsDialogOpen(false);
      setFormData({ name: "", description: "" });
    },
    onError: (error: any) => {
      toast.error(`Error al crear área: ${error.message}`);
    },
  });

  const updateMutation = useMutation({
    mutationFn: updateArea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      toast.success("Área actualizada exitosamente");
      setIsDialogOpen(false);
      setEditingArea(null);
      setFormData({ name: "", description: "" });
    },
    onError: (error: any) => {
      toast.error(`Error al actualizar área: ${error.message}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteArea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["areas"] });
      toast.success("Área eliminada exitosamente");
    },
    onError: (error: any) => {
      toast.error(`Error al eliminar área: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingArea) {
      updateMutation.mutate({ data: { id: editingArea.id, ...formData } });
    } else {
      createMutation.mutate({ data: formData });
    }
  };

  const handleEdit = (area: Area) => {
    setEditingArea(area);
    setFormData({ name: area.name, description: area.description || "" });
    setIsDialogOpen(true);
  };

  const handleDelete = (areaId: string) => {
    if (confirm("¿Estás seguro de que quieres eliminar esta área? Esta acción no se puede deshacer.")) {
      deleteMutation.mutate({ data: { id: areaId } });
    }
  };

  const handleDialogClose = () => {
    setIsDialogOpen(false);
    setEditingArea(null);
    setFormData({ name: "", description: "" });
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
      <div className="p-4 border border-red-200 bg-red-50 rounded-lg">
        <p className="text-red-800">Error al cargar las áreas. Por favor, intenta nuevamente.</p>
      </div>
    );
  }

  const areas = areasData?.areas || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Gestión de Áreas</h2>
          <p className="text-muted-foreground">Administra las áreas organizacionales de la aplicación</p>
        </div>
        <Button onClick={() => { setEditingArea(null); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nueva Área
        </Button>
        <Dialog open={isDialogOpen} onOpenChange={handleDialogClose}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingArea ? "Editar Área" : "Crear Nueva Área"}</DialogTitle>
              <DialogDescription>
                {editingArea ? "Edita la información del área" : "Crea una nueva área organizacional"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ej: Recursos Humanos"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Descripción del área..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter className="mt-6">
                <Button type="button" variant="outline" onClick={handleDialogClose}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                  {(createMutation.isPending || updateMutation.isPending) && (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  )}
                  {editingArea ? "Actualizar" : "Crear"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {areas.map((area) => (
          <Card key={area.id}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building className="h-5 w-5" />
                {area.name}
              </CardTitle>
              {area.description && (
                <CardDescription>{area.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(area)}
                  disabled={updateMutation.isPending}
                >
                  <Edit2 className="h-4 w-4 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDelete(area.id)}
                  disabled={deleteMutation.isPending}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Eliminar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {areas.length === 0 && (
        <div className="text-center py-12">
          <Building className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No hay áreas creadas</h3>
          <p className="text-muted-foreground mb-4">Crea tu primera área para comenzar a organizar tu aplicación.</p>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Crear Primera Área
          </Button>
        </div>
      )}
    </div>
  );
}

import { useState, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { checkUserPermission } from "@/lib/permissions.functions";
import { createRequest } from "@/lib/requests.functions";
import { getColumns } from "@/lib/data.functions";
import { listProfiles } from "@/lib/data.functions";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

interface ManualRequestModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function ManualRequestModal({ onClose, onCreated }: ManualRequestModalProps) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [objective, setObjective] = useState("");
  const [process, setProcess] = useState("");
  const [priority, setPriority] = useState("medium");
  const [statusColumnId, setStatusColumnId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [columns, setColumns] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [canAssignRequests, setCanAssignRequests] = useState(false);

  useEffect(() => {
    Promise.all([
      getColumns({ data: {} }),
      listProfiles(),
    ]).then(([{ columns: cols }, { profiles: users }]) => {
      setColumns(cols);
      setAvailableUsers(users);
      const firstCol = cols[0];
      if (firstCol?.id) setStatusColumnId(firstCol.id);
      setLoadingInitial(false);
    }).catch(() => setLoadingInitial(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    checkUserPermission({ data: { permission: "assign_requests" } })
      .then(({ hasPermission }) => setCanAssignRequests(hasPermission))
      .catch(() => setCanAssignRequests(false));
  }, [user]);

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!title.trim()) { toast.error("El título es obligatorio"); return; }

    setLoading(true);
    try {
      await createRequest({ data: {
        title: title.trim(),
        description: description.trim() || null,
        objective: objective.trim() || null,
        process: process.trim() || null,
        priority: priority as any,
        status_column_id: statusColumnId || null,
        assigned_to: assignedTo || null,
      }});
      toast.success("Solicitud creada exitosamente");
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? "Error al crear la solicitud");
    }
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative flex h-[85vh] w-full max-w-2xl flex-col rounded-xl border border-border bg-card shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-lg font-semibold">Nueva solicitud manual</h2>
          <Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 h-8 w-8">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loadingInitial ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="text-sm font-medium mb-1.5 block">Título *</label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Título de la solicitud" required />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Descripción</label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción detallada de la solicitud" rows={3} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Objetivo</label>
                <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Objetivo de la solicitud" rows={2} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Procesos/Pasos</label>
                <Textarea value={process} onChange={(e) => setProcess(e.target.value)} placeholder="Procesos o pasos a seguir" rows={2} />
              </div>
              <div>
                <label className="text-sm font-medium mb-1.5 block">Prioridad</label>
                <Select value={priority} onValueChange={setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Baja</SelectItem>
                    <SelectItem value="medium">Media</SelectItem>
                    <SelectItem value="high">Alta</SelectItem>
                    <SelectItem value="urgent">Urgente</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {canAssignRequests && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Estado</label>
                  <Select value={statusColumnId || ""} onValueChange={setStatusColumnId}>
                    <SelectTrigger><SelectValue placeholder="Seleccionar estado" /></SelectTrigger>
                    <SelectContent>
                      {columns.map((col) => (
                        <SelectItem key={col.id} value={col.id}>
                          <span className="flex items-center gap-1.5">
                            <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                            {col.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {canAssignRequests && (
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Asignar a</label>
                  <Select value={assignedTo || "unassigned"} onValueChange={(v) => setAssignedTo(v === "unassigned" ? null : v)}>
                    <SelectTrigger><SelectValue placeholder="Sin asignar" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Sin asignar</SelectItem>
                      {availableUsers.map((u) => (
                        <SelectItem key={u.id} value={u.id}>{u.full_name || u.email}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4">
          <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={() => handleSubmit()} disabled={loading || loadingInitial}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Crear solicitud
          </Button>
        </div>
      </div>
    </div>
  );
}

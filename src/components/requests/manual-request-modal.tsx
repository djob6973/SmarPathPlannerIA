import { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { checkUserPermission } from "@/lib/permissions.functions";
import { createRequest, getRequestsData, type RequestRow } from "@/lib/requests.functions";
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
  const [difficulty, setDifficulty] = useState("medium");
  const [type, setType] = useState("task");
  const [statusColumnId, setStatusColumnId] = useState<string | null>(null);
  const [assignedTo, setAssignedTo] = useState<string | null>(null);
  const [columns, setColumns] = useState<any[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingInitial, setLoadingInitial] = useState(true);
  const [canAssignRequests, setCanAssignRequests] = useState(false);
  const [parentRequestId, setParentRequestId] = useState<string | null>(null);
  const [topLevelRequests, setTopLevelRequests] = useState<RequestRow[]>([]);

  useEffect(() => {
    Promise.all([
      getColumns({ data: {} }),
      listProfiles(),
      getRequestsData({ data: {} }),
    ]).then(([{ columns: cols }, { profiles: users }, { requests: reqs }]) => {
      setColumns(cols);
      setAvailableUsers(users);
      setTopLevelRequests(reqs.filter((r) => !r.parent_request_id));
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
        difficulty: difficulty as any,
        type: type as any,
        status_column_id: statusColumnId || null,
        assigned_to: assignedTo || null,
        parent_request_id: parentRequestId || null,
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
    <DialogPrimitive.Root open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Panel — centered via translate trick; always relative to viewport via Portal */}
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 -translate-x-1/2 -translate-y-1/2 w-full max-w-2xl flex flex-col rounded-xl border border-border bg-card shadow-2xl focus:outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{ maxHeight: "90vh" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-6 py-4 shrink-0">
            <DialogPrimitive.Title className="text-lg font-semibold">
              Nueva solicitud manual
            </DialogPrimitive.Title>
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DialogPrimitive.Close>
          </div>

          {/* Body — scrollable */}
          <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
            {loadingInitial ? (
              <div className="flex items-center justify-center py-12">
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
                      <SelectItem value="low">low</SelectItem>
                      <SelectItem value="medium">medium</SelectItem>
                      <SelectItem value="high">high</SelectItem>
                      <SelectItem value="urgent">urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Dificultad</label>
                  <Select value={difficulty} onValueChange={setDifficulty}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="very_low">Muy Baja</SelectItem>
                      <SelectItem value="low">Baja</SelectItem>
                      <SelectItem value="medium">Media</SelectItem>
                      <SelectItem value="high">Alta</SelectItem>
                      <SelectItem value="very_high">Muy Alta</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium mb-1.5 block">Tipo</label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">BUG</SelectItem>
                      <SelectItem value="task">TASK</SelectItem>
                      <SelectItem value="feature">FEATURE</SelectItem>
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
                {topLevelRequests.length > 0 && (
                  <div>
                    <label className="text-sm font-medium mb-1.5 block">Vincular a iniciativa</label>
                    <Select value={parentRequestId || "none"} onValueChange={(v) => setParentRequestId(v === "none" ? null : v)}>
                      <SelectTrigger><SelectValue placeholder="Sin iniciativa (independiente)" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin iniciativa (independiente)</SelectItem>
                        {topLevelRequests.map((r) => (
                          <SelectItem key={r.id} value={r.id}>{r.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground mt-1">Asocia esta solicitud a un trabajo existente para agrupar iniciativas relacionadas.</p>
                  </div>
                )}
              </form>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-border px-6 py-4 shrink-0">
            <Button variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
            <Button onClick={() => handleSubmit()} disabled={loading || loadingInitial}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Crear solicitud
            </Button>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

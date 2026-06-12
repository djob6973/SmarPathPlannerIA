import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { getRequestsData, deleteRequest, type RequestRow, type ColumnRow } from "@/lib/requests.functions";
import { getAreas } from "@/lib/data.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequestDetailModal } from "@/components/requests/request-detail-modal";
import { ManualRequestModal } from "@/components/requests/manual-request-modal";
import { toast } from "sonner";
import { Search, SlidersHorizontal, Trash2, ExternalLink, Plus } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/requests")({
  component: RequestsPage,
});

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "priority-urgent", high: "priority-high",
  medium: "priority-medium", low: "priority-low",
};
const PRIORITIES = ["all", "urgent", "high", "medium", "low"];

function RequestsPage() {
  const { user, hasPermission, areaId, isSuperAdmin } = useAuth();
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [columns, setColumns] = useState<ColumnRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showManualRequestModal, setShowManualRequestModal] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);

  const canDeleteAll = hasPermission("delete_all_requests");
  const canDeleteOwn = hasPermission("delete_own_requests");

  const reload = async () => {
    setLoading(true);
    const effectiveAreaId = isSuperAdmin ? selectedArea : areaId;
    const { columns: cols, requests: reqs } = await getRequestsData({ data: { areaId: effectiveAreaId } });
    setColumns(cols);
    setRequests(reqs);
    setLoading(false);
  };

  useEffect(() => {
    reload();
    if (isSuperAdmin) {
      getAreas().then(({ areas }) => setAreas(areas));
    }
  }, [selectedArea, isSuperAdmin]);

  const filtered = useMemo(() => {
    return requests.filter((r) => {
      const matchSearch = !search || r.title.toLowerCase().includes(search.toLowerCase());
      const matchPriority = filterPriority === "all" || r.priority === filterPriority;
      const matchStatus = filterStatus === "all" || r.status_column_id === filterStatus;
      return matchSearch && matchPriority && matchStatus;
    });
  }, [requests, search, filterPriority, filterStatus]);

  const remove = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("¿Eliminar esta solicitud?")) return;
    try {
      await deleteRequest({ data: { requestId: id } });
      toast.success("Solicitud eliminada");
      reload();
    } catch (err: any) {
      toast.error(err?.message ?? "Error al eliminar");
    }
  };

  const colMap = useMemo(() => Object.fromEntries(columns.map((c) => [c.id, c])), [columns]);

  return (
    <div className="p-6 space-y-4 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Solicitudes</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.length} de {requests.length} solicitudes
          </p>
        </div>
        <div className="flex gap-2">
          {isSuperAdmin && (
            <Select value={selectedArea || "all"} onValueChange={(value) => setSelectedArea(value === "all" ? null : value)}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Todas las áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map((area) => (
                  <SelectItem key={area.id} value={area.id}>
                    {area.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Button onClick={() => setShowManualRequestModal(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Nueva solicitud manual
          </Button>
          <Button asChild variant="outline" className="gap-2">
            <Link to="/app/chat">
              <Plus className="h-4 w-4" /> Nueva solicitud con IA
            </Link>
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título..."
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="h-9 w-36 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p} className="text-xs capitalize">{p === "all" ? "Todas las prioridades" : p}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-9 w-40 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="text-xs">Todos los estados</SelectItem>
              {columns.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                    {c.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <Card className="border-border/50 overflow-hidden">
        {loading ? (
          <div className="space-y-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/50">
                <div className="h-4 w-2/5 animate-pulse rounded bg-muted" />
                <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted ml-auto" />
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3">Título</th>
                <th className="px-4 py-3 hidden md:table-cell">Estado</th>
                <th className="px-4 py-3">Prioridad</th>
                <th className="px-4 py-3 hidden lg:table-cell">Actualizado</th>
                <th className="px-4 py-3 w-20" />
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground text-sm">
                    {search || filterPriority !== "all" || filterStatus !== "all"
                      ? "No hay solicitudes que coincidan con los filtros."
                      : "Sin solicitudes aún. Usa el Chat IA para crear una."}
                  </td>
                </tr>
              )}
              {filtered.map((r) => {
                const col = r.status_column_id ? colMap[r.status_column_id] : null;
                return (
                  <tr
                    key={r.id}
                    onClick={() => setSelectedId(r.id)}
                    className="hover:bg-muted/30 cursor-pointer transition-colors group"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium truncate max-w-xs">{r.title}</p>
                      {r.description && (
                        <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{r.description}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {col ? (
                        <span className="flex items-center gap-1.5 text-xs">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: col.color }} />
                          {col.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Sin estado</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge className={cn("text-[10px] px-1.5 py-0.5 capitalize", PRIORITY_CLASS[r.priority])}>
                        {r.priority}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale: es })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7"
                          onClick={(e) => { e.stopPropagation(); setSelectedId(r.id); }}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                        {(canDeleteAll || (canDeleteOwn && r.created_by === user?.id)) && (
                          <Button
                            variant="ghost" size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={(e) => remove(r.id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <RequestDetailModal
        requestId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={reload}
      />

      {showManualRequestModal && (
        <ManualRequestModal
          onClose={() => setShowManualRequestModal(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}

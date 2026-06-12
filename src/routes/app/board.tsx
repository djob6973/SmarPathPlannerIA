import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, closestCorners, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/lib/auth-context";
import { getRequestsData, updateRequest, type RequestRow, type ColumnRow } from "@/lib/requests.functions";
import { getAreas } from "@/lib/data.functions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequestDetailModal } from "@/components/requests/request-detail-modal";
import { toast } from "sonner";
import { GripVertical, Clock, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/board")({
  component: BoardPage,
});

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "priority-urgent", high: "priority-high",
  medium: "priority-medium", low: "priority-low",
};

function KanbanCard({
  request, onClick, canEdit,
}: { request: RequestRow; onClick: () => void; canEdit: boolean }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: request.id,
    disabled: !canEdit,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        "group relative rounded-lg border border-border/50 bg-card p-3 shadow-sm transition-all hover:border-primary/30 hover:shadow-md",
        canEdit ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging && "opacity-50 shadow-lg border-primary/50"
      )}
      onClick={onClick}
    >
      {canEdit && (
        <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
      )}
      <p className="text-sm font-medium leading-snug pr-4">{request.title}</p>
      {request.description && (
        <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{request.description}</p>
      )}
      <div className="mt-2.5 flex items-center justify-between">
        <Badge className={cn("text-[10px] px-1.5 py-0 font-medium", PRIORITY_CLASS[request.priority])}>
          {request.priority}
        </Badge>
        <span className="flex items-center gap-1 text-[10px] text-muted-foreground/70">
          <Clock className="h-2.5 w-2.5" />
          {formatDistanceToNow(new Date(request.updated_at), { locale: es })}
        </span>
      </div>
    </div>
  );
}

function GhostCard({ request }: { request: RequestRow }) {
  return (
    <div className="rounded-lg border border-primary/50 bg-card p-3 shadow-2xl opacity-90 rotate-1">
      <p className="text-sm font-medium">{request.title}</p>
      <Badge className={cn("mt-2 text-[10px] px-1.5 py-0", PRIORITY_CLASS[request.priority])}>
        {request.priority}
      </Badge>
    </div>
  );
}

function KanbanColumn({
  col, requests, canEdit, onCardClick,
}: { col: ColumnRow; requests: RequestRow[]; canEdit: boolean; onCardClick: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: col.id });

  return (
    <div className="w-72 shrink-0 flex flex-col gap-2">
      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
          <span className="text-sm font-medium">{col.name}</span>
        </div>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5">{requests.length}</Badge>
      </div>
      <SortableContext items={requests.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex flex-col gap-2 min-h-[120px] rounded-lg border-2 border-dashed transition-colors p-1",
            isOver ? "border-primary/30 bg-primary/5" : "border-transparent"
          )}
        >
          {requests.map((r) => (
            <KanbanCard key={r.id} request={r} canEdit={canEdit} onClick={() => onCardClick(r.id)} />
          ))}
          {requests.length === 0 && (
            <div className="flex h-20 items-center justify-center rounded-md text-xs text-muted-foreground/50">
              Arrastra aquí
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function BoardPage() {
  const { isSuperAdmin, isAreaAdmin, hasRole, areaId } = useAuth();
  const [columns, setColumns] = useState<ColumnRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);

  const canEdit = isSuperAdmin || isAreaAdmin || hasRole("manager") || hasRole("client");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const reload = useCallback(async () => {
    setLoading(true);
    const effectiveAreaId = isSuperAdmin ? selectedArea : areaId;
    const result = await getRequestsData({ data: { areaId: effectiveAreaId } });
    setColumns(result.columns);
    setRequests(result.requests);
    setLoading(false);
  }, [areaId, isSuperAdmin, selectedArea]);

  useEffect(() => {
    reload();
    if (isSuperAdmin) {
      getAreas().then(({ areas }) => setAreas(areas));
    }
  }, [reload, isSuperAdmin]);

  // Poll every 5 seconds instead of Supabase Realtime
  useEffect(() => {
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [reload]);

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string);

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    let targetColId: string | null = null;
    let targetPosition: number | null = null;

    if (columns.some((c) => c.id === over.id)) {
      targetColId = over.id as string;
      const targetColCards = requests.filter((r) => r.status_column_id === targetColId);
      targetPosition = targetColCards.length;
    } else {
      const overCard = requests.find((r) => r.id === over.id);
      targetColId = overCard?.status_column_id ?? null;
      const activeCard = requests.find((r) => r.id === active.id);
      if (!activeCard) return;

      if (activeCard.status_column_id === targetColId) {
        const colCards = [...requests.filter((r) => r.status_column_id === targetColId)]
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const oldIndex = colCards.findIndex((r) => r.id === active.id);
        const newIndex = colCards.findIndex((r) => r.id === over.id);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        const reordered = arrayMove(colCards, oldIndex, newIndex);
        const posMap = new Map(reordered.map((r, i) => [r.id, i]));
        setRequests((prev) => prev.map((r) => posMap.has(r.id) ? { ...r, position: posMap.get(r.id)! } : r));
        await Promise.all(
          reordered.map((r, i) => updateRequest({ data: { requestId: r.id, position: i } }))
        );
        return;
      }
      const targetColCards = requests.filter((r) => r.status_column_id === targetColId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const overIndex = targetColCards.findIndex((r) => r.id === over.id);
      targetPosition = overIndex !== -1 ? overIndex : targetColCards.length;
    }

    const activeCard = requests.find((r) => r.id === active.id);
    if (!activeCard) return;

    setRequests((prev) =>
      prev.map((r) => r.id === active.id ? { ...r, status_column_id: targetColId, position: targetPosition } : r)
    );

    try {
      await updateRequest({ data: { requestId: String(active.id), status_column_id: targetColId, position: targetPosition ?? 0 } });
    } catch {
      toast.error("Error al mover la tarjeta");
      reload();
    }
  };

  const activeRequest = activeId ? requests.find((r) => r.id === activeId) : null;

  if (loading && requests.length === 0) {
    return (
      <div className="flex gap-4 p-6 overflow-x-auto">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 space-y-2">
            <div className="h-10 animate-pulse rounded-lg bg-muted" />
            {Array.from({ length: 3 }).map((__, j) => (
              <div key={j} className="h-20 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border/50 px-6 py-3 shrink-0">
        <h1 className="text-lg font-semibold">Tablero Kanban</h1>
        <div className="flex items-center gap-3">
          {isSuperAdmin && areas.length > 0 && (
            <Select
              value={selectedArea || "all"}
              onValueChange={(v) => setSelectedArea(v === "all" ? null : v)}
            >
              <SelectTrigger className="w-44 h-8 text-xs">
                <SelectValue placeholder="Todas las áreas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          {isSuperAdmin && (
            <Button asChild variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
              <Link to="/app/settings"><Settings className="h-3.5 w-3.5" />Columnas</Link>
            </Button>
          )}
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto p-6">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="flex gap-4">
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                col={col}
                requests={requests
                  .filter((r) => r.status_column_id === col.id)
                  .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))}
                canEdit={canEdit}
                onCardClick={setSelectedId}
              />
            ))}
            {columns.length === 0 && !loading && (
              <div className="flex h-48 w-full items-center justify-center rounded-xl border-2 border-dashed border-border/50 text-sm text-muted-foreground">
                Sin columnas. {isSuperAdmin && <Link to="/app/settings" className="text-primary hover:underline ml-1">Configura el tablero</Link>}
              </div>
            )}
          </div>
          <DragOverlay>
            {activeRequest && <GhostCard request={activeRequest} />}
          </DragOverlay>
        </DndContext>
      </div>

      {selectedId && (
        <RequestDetailModal
          requestId={selectedId}
          onClose={() => setSelectedId(null)}
          onUpdated={reload}
        />
      )}
    </div>
  );
}

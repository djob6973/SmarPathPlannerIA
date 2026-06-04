import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, closestCorners, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequestDetailModal } from "@/components/requests/request-detail-modal";
import { toast } from "sonner";
import { GripVertical, MessageSquare, Clock, Settings } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/board")({
  component: BoardPage,
});

type Column = { id: string; name: string; position: number; color: string; is_completed: boolean };
type Request = {
  id: string; title: string; description: string | null; priority: string;
  status_column_id: string | null; position: number | null; created_at: string; updated_at: string;
};

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "priority-urgent", high: "priority-high",
  medium: "priority-medium", low: "priority-low",
};

// ── Draggable card ──────────────────────────────────────────────
function KanbanCard({
  request, onClick, canEdit,
}: { request: Request; onClick: () => void; canEdit: boolean }) {
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

// ── Ghost card (drag overlay) ────────────────────────────────────
function GhostCard({ request }: { request: Request }) {
  return (
    <div className="rounded-lg border border-primary/50 bg-card p-3 shadow-2xl opacity-90 rotate-1">
      <p className="text-sm font-medium">{request.title}</p>
      <Badge className={cn("mt-2 text-[10px] px-1.5 py-0", PRIORITY_CLASS[request.priority])}>
        {request.priority}
      </Badge>
    </div>
  );
}

// ── Column drop zone ─────────────────────────────────────────────
function KanbanColumn({
  col, requests, canEdit, onCardClick,
}: { col: Column; requests: Request[]; canEdit: boolean; onCardClick: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({
    id: col.id,
  });

  return (
    <div className="w-72 shrink-0 flex flex-col gap-2">
      {/* Column header */}
      <div className="flex items-center justify-between rounded-lg border border-border/50 bg-card/60 px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: col.color }} />
          <span className="text-sm font-medium">{col.name}</span>
        </div>
        <Badge variant="outline" className="text-[10px] h-5 px-1.5">{requests.length}</Badge>
      </div>

      {/* Cards */}
      <SortableContext items={requests.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          className={cn(
            "flex flex-col gap-2 min-h-[120px] rounded-lg border-2 border-dashed transition-colors p-1",
            isOver ? "border-primary/30 bg-primary/5" : "border-transparent"
          )}
        >
          {requests.map((r) => (
            <KanbanCard
              key={r.id}
              request={r}
              canEdit={canEdit}
              onClick={() => onCardClick(r.id)}
            />
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

// ── Main page ────────────────────────────────────────────────────
function BoardPage() {
  const { hasRole, areaId, isSuperAdmin } = useAuth();
  const [columns, setColumns] = useState<Column[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);

  const canEdit = isSuperAdmin || isAreaAdmin || hasRole("manager") || hasRole("client");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const loadAreas = async () => {
    const { data } = await supabase.from("areas").select("*").order("name");
    setAreas(data || []);
  };

  const reload = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("requests").select("*").order("position", { ascending: true }).order("updated_at", { ascending: false });

    // Filter by area
    const effectiveAreaId = isSuperAdmin ? selectedArea : areaId;
    if (effectiveAreaId) {
      query = query.eq("area_id", effectiveAreaId);
    }

    const [{ data: cols }, { data: reqs }] = await Promise.all([
      supabase.from("kanban_columns").select("*").order("position"),
      query,
    ]);
    setColumns((cols ?? []) as Column[]);
    setRequests((reqs ?? []) as Request[]);
    setLoading(false);
  }, [areaId, isSuperAdmin, selectedArea]);

  useEffect(() => {
    reload();
    if (isSuperAdmin) {
      loadAreas();
    }
  }, [reload, isSuperAdmin]);

  // Supabase Realtime for live updates
  useEffect(() => {
    const channel = supabase
      .channel("board-requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "requests" }, reload)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [reload]);

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string);

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    let targetColId: string | null = null;
    let targetPosition: number | null = null;

    if (columns.some((c) => c.id === over.id)) {
      // Dropped on a column (empty space)
      targetColId = over.id as string;
      // Calculate new position (append to end of target column)
      const targetColCards = requests.filter((r) => r.status_column_id === targetColId);
      targetPosition = targetColCards.length;
    } else {
      // Dropped on a card
      const overCard = requests.find((r) => r.id === over.id);
      targetColId = overCard?.status_column_id ?? null;
      const activeCard = requests.find((r) => r.id === active.id);
      if (!activeCard) return;

      if (activeCard.status_column_id === targetColId) {
        // Reorder within the same column
        const colCards = [...requests.filter((r) => r.status_column_id === targetColId)]
          .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
        const oldIndex = colCards.findIndex((r) => r.id === active.id);
        const newIndex = colCards.findIndex((r) => r.id === over.id);
        if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
        const reordered = arrayMove(colCards, oldIndex, newIndex);
        const posMap = new Map(reordered.map((r, i) => [r.id, i]));
        setRequests((prev) => prev.map((r) => posMap.has(r.id) ? { ...r, position: posMap.get(r.id)! } : r));
        await Promise.all(
          reordered.map((r, i) => supabase.from("requests").update({ position: i }).eq("id", r.id))
        );
        return;
      }
      // Moving to different column - insert before the over card
      const targetColCards = requests.filter((r) => r.status_column_id === targetColId)
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
      const overIndex = targetColCards.findIndex((r) => r.id === over.id);
      targetPosition = overIndex !== -1 ? overIndex : targetColCards.length;
    }

    const activeCard = requests.find((r) => r.id === active.id);
    if (!activeCard) return;

    // Move to a different column
    setRequests((prev) =>
      prev.map((r) => r.id === active.id ? { ...r, status_column_id: targetColId, position: targetPosition } : r)
    );

    const { error } = await supabase
      .from("requests")
      .update({ status_column_id: targetColId, position: targetPosition })
      .eq("id", String(active.id));

    if (error) {
      toast.error("Error al mover la tarjeta");
      reload();
    }
  };

  const activeRequest = activeId ? requests.find((r) => r.id === activeId) : null;

  if (loading) {
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
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50">
        <div>
          <h1 className="text-xl font-bold">Tablero Kanban</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {requests.length} solicitude{requests.length !== 1 ? "s" : ""} · {columns.length} columnas
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isSuperAdmin && (
            <Select value={selectedArea || "all"} onValueChange={(value) => setSelectedArea(value === "all" ? null : value)}>
              <SelectTrigger className="w-48 h-9">
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
          {hasRole("admin") && (
            <Button asChild variant="outline" className="gap-2 h-9">
              <Link to="/app/settings">
                <Settings className="h-4 w-4" />
                Columnas
              </Link>
            </Button>
          )}
          <Button asChild className="gap-2 h-9">
            <Link to="/app/chat">
              <MessageSquare className="h-4 w-4" />
              Nueva con IA
            </Link>
          </Button>
        </div>
      </div>

      {/* Board */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto p-6 flex-1">
          {columns.map((col) => {
            const colRequests = requests.filter((r) => r.status_column_id === col.id);
            return (
              <KanbanColumn
                key={col.id}
                col={col}
                requests={colRequests}
                canEdit={canEdit}
                onCardClick={setSelectedId}
              />
            );
          })}

          {/* Backlog — requests with no column */}
          {(() => {
            const backlog = requests.filter((r) => !r.status_column_id);
            if (backlog.length === 0) return null;
            return (
              <div className="w-72 shrink-0 flex flex-col gap-2">
                <div className="flex items-center justify-between rounded-lg border border-dashed border-border px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
                    <span className="text-sm font-medium text-muted-foreground">Sin estado</span>
                  </div>
                  <Badge variant="outline" className="text-[10px] h-5 px-1.5">{backlog.length}</Badge>
                </div>
                <div className="flex flex-col gap-2 p-1">
                  {backlog.map((r) => (
                    <KanbanCard key={r.id} request={r} canEdit={false} onClick={() => setSelectedId(r.id)} />
                  ))}
                </div>
              </div>
            );
          })()}

          {columns.length === 0 && (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">Sin columnas configuradas.</p>
                <Button asChild variant="outline" size="sm" className="mt-3">
                  <Link to="/app/settings">Configurar columnas</Link>
                </Button>
              </div>
            </div>
          )}
        </div>

        <DragOverlay>
          {activeRequest && <GhostCard request={activeRequest} />}
        </DragOverlay>
      </DndContext>

      <RequestDetailModal
        requestId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={reload}
      />
    </div>
  );
}

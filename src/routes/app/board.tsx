import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo } from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, closestCorners, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/lib/auth-context";
import { getRequestsData, updateRequest, type RequestRow, type ColumnRow } from "@/lib/requests.functions";
import { getAreas, listProfiles } from "@/lib/data.functions";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequestDetailModal } from "@/components/requests/request-detail-modal";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/app/board")({
  component: BoardPage,
});

// ── Constants ─────────────────────────────────────────────────────────────────

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "priority-urgent", high: "priority-high",
  medium: "priority-medium", low: "priority-low",
};
const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente", high: "Alta", medium: "Media", low: "Baja",
};
const BACKLOG_ID = "__backlog__";
type ProfileMap = Map<string, { id: string; full_name: string | null }>;

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconSparkle() {
  return (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor">
      <path d="M12 2 14.09 8.26 20 12 14.09 15.74 12 22 9.91 15.74 4 12 9.91 8.26z" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(name: string | null): string {
  const src = name ?? "?";
  return src.split(/[\s._]/).map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase() || "?";
}

// ── KanbanCard ────────────────────────────────────────────────────────────────

function KanbanCard({
  request, onClick, canEdit, profiles,
}: { request: RequestRow; onClick: () => void; canEdit: boolean; profiles: ProfileMap }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: request.id,
    disabled: !canEdit,
  });

  const assignee = request.assigned_to ? (profiles.get(request.assigned_to) ?? null) : null;
  const abbr = assignee ? getInitials(assignee.full_name) : null;

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      {...attributes}
      {...listeners}
    >
      <div
        className="sp-kcard"
        style={{
          background: "var(--card)",
          border: "1px solid var(--border)",
          borderRadius: 14,
          padding: "13px 14px 11px",
          cursor: canEdit ? (isDragging ? "grabbing" : "grab") : "pointer",
        }}
        onClick={onClick}
      >
        <p style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.42, color: "var(--foreground)", margin: 0 }}>
          {request.title}
        </p>
        {request.description && (
          <p
            className="line-clamp-2"
            style={{ fontSize: 12, color: "var(--muted-foreground)", marginTop: 5, marginBottom: 0, lineHeight: 1.5 }}
          >
            {request.description}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 11, gap: 6 }}>
          <Badge className={cn("text-[10px] px-1.5 py-0 h-5 font-medium", PRIORITY_CLASS[request.priority])}>
            {PRIORITY_LABEL[request.priority] ?? request.priority}
          </Badge>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            {abbr && (
              <span style={{
                width: 20, height: 20, borderRadius: "50%",
                background: "#ED5650", color: "#fff",
                fontSize: 8, fontWeight: 700,
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {abbr}
              </span>
            )}
            <span style={{ fontSize: 10.5, color: "var(--muted-foreground)", whiteSpace: "nowrap", opacity: 0.7 }}>
              {formatDistanceToNow(new Date(request.updated_at), { locale: es })}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── GhostCard (drag overlay) ──────────────────────────────────────────────────

function GhostCard({ request }: { request: RequestRow }) {
  return (
    <div style={{
      width: 282,
      background: "var(--card)",
      border: "1.5px solid var(--primary)",
      borderRadius: 14,
      padding: "13px 14px 11px",
      boxShadow: "0 14px 32px rgba(0,0,0,.16)",
      transform: "rotate(1.5deg)",
      opacity: 0.93,
    }}>
      <p style={{ fontSize: 13.5, fontWeight: 500, lineHeight: 1.42, color: "var(--foreground)", margin: 0 }}>
        {request.title}
      </p>
      <div style={{ marginTop: 11 }}>
        <Badge className={cn("text-[10px] px-1.5 py-0 h-5 font-medium", PRIORITY_CLASS[request.priority])}>
          {PRIORITY_LABEL[request.priority] ?? request.priority}
        </Badge>
      </div>
    </div>
  );
}

// ── KanbanColumn ──────────────────────────────────────────────────────────────

interface ColProps {
  col?: ColumnRow;
  requests: RequestRow[];
  canEdit: boolean;
  onCardClick: (id: string) => void;
  profiles: ProfileMap;
  isBacklog?: boolean;
}

function KanbanColumn({ col, requests, canEdit, onCardClick, profiles, isBacklog = false }: ColProps) {
  const droppableId = isBacklog ? BACKLOG_ID : (col?.id ?? BACKLOG_ID);
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const dotColor = isBacklog ? "#C8C8C8" : (col?.color ?? "#D5D6D7");
  const colName  = isBacklog ? "Sin estado" : (col?.name ?? "");

  return (
    <div style={{ width: 286, flexShrink: 0, display: "flex", flexDirection: "column", gap: 10 }}>

      {/* Column header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "var(--card)",
        border: isBacklog ? "1.5px dashed var(--border)" : "1px solid var(--border)",
        borderRadius: 12, padding: "9px 14px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: dotColor, flexShrink: 0 }} />
          <span style={{
            fontSize: 13.5, fontWeight: 500,
            color: isBacklog ? "var(--muted-foreground)" : "var(--foreground)",
          }}>
            {colName}
          </span>
        </div>
        <span style={{
          minWidth: 22, textAlign: "center",
          fontSize: 11.5, fontWeight: 600, padding: "2px 8px",
          borderRadius: 999, background: "var(--muted)", color: "var(--muted-foreground)",
        }}>
          {requests.length}
        </span>
      </div>

      {/* Droppable cards area */}
      <SortableContext items={requests.map((r) => r.id)} strategy={verticalListSortingStrategy}>
        <div
          ref={setNodeRef}
          style={{
            display: "flex", flexDirection: "column", gap: 8,
            minHeight: 80, borderRadius: 12, padding: 2,
            border: `2px dashed ${isOver ? "var(--primary)" : "transparent"}`,
            transition: "border-color 100ms ease",
          }}
        >
          {requests.map((r) => (
            <KanbanCard
              key={r.id}
              request={r}
              canEdit={canEdit}
              onClick={() => onCardClick(r.id)}
              profiles={profiles}
            />
          ))}
          {requests.length === 0 && (
            <div style={{ height: 68, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 12, color: "var(--muted-foreground)", opacity: 0.4 }}>
                Arrastra aquí
              </span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── BoardPage ─────────────────────────────────────────────────────────────────

function BoardPage() {
  const { isSuperAdmin, areaId, hasPermission } = useAuth();

  if (!hasPermission("view_board")) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Sin acceso</p>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>No tienes permiso para ver el tablero.</p>
      </div>
    );
  }

  const [columns, setColumns] = useState<ColumnRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [profiles, setProfiles] = useState<ProfileMap>(new Map());
  const [filterAssignedTo, setFilterAssignedTo] = useState("all");

  const canEdit = hasPermission("change_request_status") || hasPermission("edit_all_requests") || hasPermission("edit_own_requests");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

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
    listProfiles().then(({ profiles: rows }) => {
      setProfiles(new Map(rows.map((p) => [p.id, p])));
    });
    if (isSuperAdmin) {
      getAreas().then(({ areas: rows }) => setAreas(rows));
    }
  }, [reload, isSuperAdmin]);

  useEffect(() => {
    const timer = setInterval(reload, 5000);
    return () => clearInterval(timer);
  }, [reload]);

  const handleDragStart = ({ active }: DragStartEvent) => setActiveId(active.id as string);

  const handleDragEnd = async ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (!over || active.id === over.id) return;

    let targetColId: string | null = null;
    let targetPosition = 0;

    if (over.id === BACKLOG_ID) {
      targetColId = null;
      targetPosition = requests.filter((r) => !r.status_column_id).length;
    } else if (columns.some((c) => c.id === over.id)) {
      targetColId = over.id as string;
      targetPosition = requests.filter((r) => r.status_column_id === targetColId).length;
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
        await Promise.all(reordered.map((r, i) => updateRequest({ data: { requestId: r.id, position: i } })));
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
      await updateRequest({ data: { requestId: String(active.id), status_column_id: targetColId, position: targetPosition } });
    } catch {
      toast.error("Error al mover la tarjeta");
      reload();
    }
  };

  const filteredRequests = useMemo(() =>
    requests.filter((r) =>
      filterAssignedTo === "all" || r.assigned_to === filterAssignedTo
    ),
    [requests, filterAssignedTo]
  );

  const activeRequest  = activeId ? filteredRequests.find((r) => r.id === activeId) : null;
  const backlogRequests = filteredRequests
    .filter((r) => !r.status_column_id)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  const selectedAreaName = selectedArea ? areas.find((a) => a.id === selectedArea)?.name : null;

  // ── Loading skeleton ──────────────────────────────────────────────────────────

  if (loading && requests.length === 0) {
    return (
      <div style={{ padding: "24px 28px", animation: "spIn 240ms ease" }}>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22 }}>
          <div>
            <div className="h-7 w-24 animate-pulse rounded-xl bg-muted" />
            <div className="mt-2 h-4 w-44 animate-pulse rounded-lg bg-muted" />
          </div>
          <div className="h-9 w-32 animate-pulse rounded-full bg-muted" />
        </div>
        <div style={{ display: "flex", gap: 18 }}>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ width: 286, flexShrink: 0 }}>
              <div className="h-11 animate-pulse rounded-xl bg-muted" />
              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                {Array.from({ length: 3 }).map((__, j) => (
                  <div key={j} className="animate-pulse rounded-xl bg-muted" style={{ height: 88 }} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Main render ───────────────────────────────────────────────────────────────

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>

      {/* ── Page header ── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "20px 28px 16px",
        borderBottom: "1px solid var(--border)",
        flexShrink: 0, gap: 12,
        animation: "spIn 240ms ease",
      }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 24,
            color: "var(--foreground)", letterSpacing: "-0.015em", margin: 0,
          }}>
            Tablero
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3, marginBottom: 0 }}>
            {filteredRequests.length !== requests.length
              ? `${filteredRequests.length} de ${requests.length} solicitudes · ${columns.length} columna${columns.length !== 1 ? "s" : ""}`
              : `${requests.length} solicitud${requests.length !== 1 ? "es" : ""} · ${columns.length} columna${columns.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <select
            value={filterAssignedTo}
            onChange={(e) => setFilterAssignedTo(e.target.value)}
            style={{
              height: 38, padding: "0 14px",
              borderRadius: 999,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: filterAssignedTo !== "all" ? "var(--primary)" : "var(--foreground)",
              fontSize: 13, cursor: "pointer", outline: "none",
              fontWeight: filterAssignedTo !== "all" ? 600 : 400,
            }}
          >
            <option value="all">Asignado a: Todos</option>
            {Array.from(profiles.values()).map((p) => (
              <option key={p.id} value={p.id}>{p.full_name ?? "Sin nombre"}</option>
            ))}
          </select>

          {isSuperAdmin && areas.length > 0 && (
            <Select value={selectedArea || "all"} onValueChange={(v) => setSelectedArea(v === "all" ? null : v)}>
              <SelectTrigger
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  background: "var(--card)", border: "1px solid var(--border)", borderRadius: 999,
                  padding: "7px 14px", height: "auto", fontSize: 13, width: "auto", minWidth: 0,
                }}
              >
                <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--primary)", flexShrink: 0 }} />
                <span style={{ color: "var(--muted-foreground)" }}>Área:</span>
                <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{selectedAreaName ?? "Todas"}</span>
                <IconChevron />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las áreas</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <Link
            to="/app/chat"
            style={{
              display: "inline-flex", alignItems: "center", gap: 7,
              background: "#ED5650", color: "#fff", borderRadius: 999,
              padding: "9px 20px", fontSize: 13.5, fontWeight: 600,
              textDecoration: "none", flexShrink: 0,
              boxShadow: "0 2px 8px rgba(237,86,80,.25)",
            }}
          >
            <IconSparkle /> Nueva con IA
          </Link>
        </div>
      </div>

      {/* ── Board canvas ── */}
      <div style={{ flex: 1, overflowX: "auto", padding: "22px 28px 36px" }}>
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div style={{ display: "flex", gap: 18, alignItems: "flex-start" }}>
            {columns.map((col) => (
              <KanbanColumn
                key={col.id}
                col={col}
                requests={filteredRequests
                  .filter((r) => r.status_column_id === col.id)
                  .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))}
                canEdit={canEdit}
                onCardClick={setSelectedId}
                profiles={profiles}
              />
            ))}

            {/* Backlog — requests with no column assigned */}
            <KanbanColumn
              isBacklog
              requests={backlogRequests}
              canEdit={canEdit}
              onCardClick={setSelectedId}
              profiles={profiles}
            />

            {columns.length === 0 && !loading && (
              <div style={{
                flex: 1, minHeight: 180, display: "flex", alignItems: "center", justifyContent: "center",
                border: "2px dashed var(--border)", borderRadius: 16,
                fontSize: 14, color: "var(--muted-foreground)",
              }}>
                Sin columnas.{" "}
                {isSuperAdmin && (
                  <Link
                    to="/app/settings"
                    style={{ color: "var(--primary)", marginLeft: 4, fontWeight: 600, textDecoration: "none" }}
                  >
                    Configura el tablero
                  </Link>
                )}
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

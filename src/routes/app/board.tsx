import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { SlidersHorizontal, Plus } from "lucide-react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent, closestCorners, useDroppable,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { getRequestsData, updateRequest, type RequestRow, type ColumnRow } from "@/lib/requests.functions";
import { getAreas, listProfiles } from "@/lib/data.functions";
import { ManualRequestModal } from "@/components/requests/manual-request-modal";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequestDetailModal } from "@/components/requests/request-detail-modal";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { es, enUS, ptBR } from "date-fns/locale";
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
  const { lang } = useLang();
  const dateLocale = lang === "en" ? enUS : lang === "pt" ? ptBR : es;
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
              {formatDistanceToNow(new Date(request.updated_at), { locale: dateLocale })}
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
  const { t } = useLang();
  const droppableId = isBacklog ? BACKLOG_ID : (col?.id ?? BACKLOG_ID);
  const { setNodeRef, isOver } = useDroppable({ id: droppableId });
  const dotColor = isBacklog ? "#C8C8C8" : (col?.color ?? "#D5D6D7");
  const colName  = isBacklog ? t("board.noStatus") : (col?.name ?? "");

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
                {t("board.dropHere")}
              </span>
            </div>
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const btnOutlineStyle: React.CSSProperties = {
  display: "flex", alignItems: "center", gap: 7,
  height: 40, padding: "0 18px",
  borderRadius: "var(--r-xl, 16px)",
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 13, fontWeight: 500,
  cursor: "pointer", whiteSpace: "nowrap",
};

const btnCoralStyle: React.CSSProperties = {
  display: "inline-flex", alignItems: "center", gap: 7,
  height: 40, padding: "0 18px",
  borderRadius: "var(--r-xl, 16px)",
  background: "#ED5650", color: "white",
  textDecoration: "none", fontSize: 13, fontWeight: 500,
  whiteSpace: "nowrap", flexShrink: 0,
};

const popoverLabelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 700,
  textTransform: "uppercase", letterSpacing: ".08em",
  color: "var(--muted-foreground)", marginBottom: 6,
};

const popoverSubLabelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4,
};

const popoverInputStyle: React.CSSProperties = {
  width: "100%", height: 36, padding: "0 10px",
  borderRadius: "var(--r-sm, 10px)",
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 13, cursor: "pointer", outline: "none",
};

// ── BoardPage ─────────────────────────────────────────────────────────────────

function BoardPage() {
  const { isSuperAdmin, areaId, hasPermission } = useAuth();
  const { t, lang } = useLang();
  const dateLocale = lang === "en" ? enUS : lang === "pt" ? ptBR : es;

  if (!hasPermission("view_board")) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{t("common.noAccess")}</p>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{t("board.noPermission")}</p>
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
  const [filterPriority, setFilterPriority]       = useState("all");
  const [filterStatus, setFilterStatus]           = useState("all");
  const [filterCreatedFrom, setFilterCreatedFrom] = useState("");
  const [filterCreatedTo, setFilterCreatedTo]     = useState("");
  const [filterCompletedFrom, setFilterCompletedFrom] = useState("");
  const [filterCompletedTo, setFilterCompletedTo]     = useState("");
  const [filterOpen, setFilterOpen]               = useState(false);
  const [showManual, setShowManual]               = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  const activeFilterCount = [
    filterAssignedTo !== "all",
    filterPriority !== "all",
    filterStatus !== "all",
    !!filterCreatedFrom, !!filterCreatedTo,
    !!filterCompletedFrom, !!filterCompletedTo,
  ].filter(Boolean).length;

  function clearAllFilters() {
    setFilterAssignedTo("all");
    setFilterPriority("all");
    setFilterStatus("all");
    setFilterCreatedFrom(""); setFilterCreatedTo("");
    setFilterCompletedFrom(""); setFilterCompletedTo("");
  }

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
      toast.error(t("requests.moveError"));
      reload();
    }
  };

  const filteredRequests = useMemo(() =>
    requests.filter((r) => {
      if (filterAssignedTo !== "all" && r.assigned_to !== filterAssignedTo) return false;
      if (filterPriority !== "all" && r.priority !== filterPriority) return false;
      if (filterStatus !== "all" && r.status_column_id !== filterStatus) return false;
      if (filterCreatedFrom && r.created_at < filterCreatedFrom) return false;
      if (filterCreatedTo && r.created_at > filterCreatedTo + "T23:59:59") return false;
      if (filterCompletedFrom && (!r.completed_at || r.completed_at < filterCompletedFrom)) return false;
      if (filterCompletedTo && (!r.completed_at || r.completed_at > filterCompletedTo + "T23:59:59")) return false;
      return true;
    }),
    [requests, filterAssignedTo, filterPriority, filterStatus, filterCreatedFrom, filterCreatedTo, filterCompletedFrom, filterCompletedTo]
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
            {t("board.title")}
          </h1>
          <p style={{ fontSize: 13, color: "var(--muted-foreground)", marginTop: 3, marginBottom: 0 }}>
            {filteredRequests.length !== requests.length
              ? `${filteredRequests.length} de ${requests.length} solicitudes · ${columns.length} columna${columns.length !== 1 ? "s" : ""}`
              : `${requests.length} solicitud${requests.length !== 1 ? "es" : ""} · ${columns.length} columna${columns.length !== 1 ? "s" : ""}`}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                <span style={{ color: "var(--muted-foreground)" }}>{t("dashboard.areaLabel")}</span>
                <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{selectedAreaName ?? t("dashboard.areaAll")}</span>
                <IconChevron />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("common.allAreas")}</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Filter popover */}
          <div ref={filterRef} style={{ position: "relative" }}>
            <button
              onClick={() => setFilterOpen((v) => !v)}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "8px 14px",
                borderRadius: "var(--r-sm, 10px)",
                border: `1px solid ${filterOpen || activeFilterCount > 0 ? "var(--primary)" : "var(--border)"}`,
                background: filterOpen || activeFilterCount > 0 ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--card)",
                color: activeFilterCount > 0 ? "var(--primary)" : "var(--muted-foreground)",
                fontSize: 13, cursor: "pointer", fontWeight: 500,
                transition: "all 120ms", whiteSpace: "nowrap",
              }}
            >
              <SlidersHorizontal size={14} />
              {t("requests.filters")}
              {activeFilterCount > 0 && (
                <span style={{
                  background: "var(--primary)", color: "var(--primary-foreground)",
                  borderRadius: 99, fontSize: 10, fontWeight: 700,
                  minWidth: 18, height: 18, lineHeight: 1,
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  padding: "0 5px",
                }}>
                  {activeFilterCount}
                </span>
              )}
            </button>

            {filterOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 8px)", right: 0, zIndex: 50,
                width: 340,
                background: "var(--card)",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-card, 20px)",
                boxShadow: "0 12px 40px rgba(0,0,0,.3)",
                padding: 20,
                animation: "spIn .15s ease both",
              }}>
                {/* Prioridad + Estado */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={popoverLabelStyle}>{t("requests.priority")}</label>
                    <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={popoverInputStyle}>
                      <option value="all">{t("requests.allPriorities")}</option>
                      {["urgent","high","medium","low"].map((p) => (
                        <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label style={popoverLabelStyle}>{t("requests.status")}</label>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={popoverInputStyle}>
                      <option value="all">{t("requests.allStatuses")}</option>
                      {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Asignado a */}
                <div style={{ marginBottom: 16 }}>
                  <label style={popoverLabelStyle}>{t("requests.assignedTo")}</label>
                  <select value={filterAssignedTo} onChange={(e) => setFilterAssignedTo(e.target.value)} style={popoverInputStyle}>
                    <option value="all">{t("requests.allAssigned")}</option>
                    {Array.from(profiles.values()).map((p) => (
                      <option key={p.id} value={p.id}>{p.full_name ?? t("common.noName")}</option>
                    ))}
                  </select>
                </div>

                {/* Divider */}
                <div style={{ height: 1, background: "var(--border)", margin: "0 0 16px" }} />

                {/* Fecha creación */}
                <div style={{ marginBottom: 12 }}>
                  <label style={popoverLabelStyle}>{t("requests.creationDate")}</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <span style={popoverSubLabelStyle}>{t("common.from")}</span>
                      <input type="date" value={filterCreatedFrom} onChange={(e) => setFilterCreatedFrom(e.target.value)} style={popoverInputStyle} />
                    </div>
                    <div>
                      <span style={popoverSubLabelStyle}>{t("common.to")}</span>
                      <input type="date" value={filterCreatedTo} onChange={(e) => setFilterCreatedTo(e.target.value)} style={popoverInputStyle} />
                    </div>
                  </div>
                </div>

                {/* Fecha completada */}
                <div style={{ marginBottom: 20 }}>
                  <label style={popoverLabelStyle}>{t("requests.completedDate")}</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <span style={popoverSubLabelStyle}>{t("common.from")}</span>
                      <input type="date" value={filterCompletedFrom} onChange={(e) => setFilterCompletedFrom(e.target.value)} style={popoverInputStyle} />
                    </div>
                    <div>
                      <span style={popoverSubLabelStyle}>{t("common.to")}</span>
                      <input type="date" value={filterCompletedTo} onChange={(e) => setFilterCompletedTo(e.target.value)} style={popoverInputStyle} />
                    </div>
                  </div>
                </div>

                {/* Footer */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    onClick={clearAllFilters}
                    disabled={activeFilterCount === 0}
                    style={{
                      background: "transparent", border: "none", padding: "4px 0",
                      color: activeFilterCount === 0 ? "var(--muted-foreground)" : "#ef4444",
                      fontSize: 13, cursor: activeFilterCount === 0 ? "default" : "pointer",
                      opacity: activeFilterCount === 0 ? 0.45 : 1,
                    }}
                  >
                    {t("common.clearAll")}
                  </button>
                  <button
                    onClick={() => setFilterOpen(false)}
                    style={{
                      background: "var(--primary)", color: "var(--primary-foreground)",
                      border: "none", borderRadius: "var(--r-sm, 10px)",
                      padding: "7px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    {t("common.apply")}
                  </button>
                </div>
              </div>
            )}
          </div>

          {hasPermission("create_requests") && (
            <button onClick={() => setShowManual(true)} style={btnOutlineStyle}>
              <Plus size={14} /> {t("requests.newManual")}
            </button>
          )}

          {hasPermission("use_ai_features") && (
            <Link to="/app/chat" style={btnCoralStyle}>
              <IconSparkle /> {t("requests.newWithAI")}
            </Link>
          )}
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

      {showManual && (
        <ManualRequestModal
          onClose={() => setShowManual(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}

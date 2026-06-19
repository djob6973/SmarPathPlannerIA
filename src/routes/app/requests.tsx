import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useAuth } from "@/lib/auth-context";
import { getRequestsData, deleteRequest, type RequestRow, type ColumnRow } from "@/lib/requests.functions";
import { getAreas, listProfiles } from "@/lib/data.functions";
import { RequestDetailModal } from "@/components/requests/request-detail-modal";
import { ManualRequestModal } from "@/components/requests/manual-request-modal";
import { toast } from "sonner";
import { Search, MessageSquare, Trash2, ExternalLink, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/app/requests")({
  component: RequestsPage,
});

const priStyle: Record<string, React.CSSProperties> = {
  urgent: { background: "rgba(239,68,68,.12)", color: "#ef4444", border: "1px solid rgba(239,68,68,.25)" },
  high:   { background: "rgba(249,115,22,.12)", color: "#f97316", border: "1px solid rgba(249,115,22,.25)" },
  medium: { background: "rgba(234,179,8,.12)",  color: "#ca8a04", border: "1px solid rgba(234,179,8,.25)" },
  low:    { background: "rgba(100,116,139,.12)", color: "#64748b", border: "1px solid rgba(100,116,139,.25)" },
};

const PRIORITIES = ["urgent", "high", "medium", "low"];
const PAGE_SIZES = [10, 20, 50];

const GRID = "1fr 150px 110px 130px 56px";

function RequestsPage() {
  const { user, hasPermission, areaId, isSuperAdmin } = useAuth();
  const [requests, setRequests]   = useState<RequestRow[]>([]);
  const [columns, setColumns]     = useState<ColumnRow[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState("");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterStatus, setFilterStatus]     = useState("all");
  const [selectedId, setSelectedId]         = useState<string | null>(null);
  const [showManual, setShowManual]         = useState(false);
  const [selectedArea, setSelectedArea]     = useState<string | null>(null);
  const [areas, setAreas]                   = useState<{ id: string; name: string }[]>([]);
  const [filterAssigned, setFilterAssigned] = useState("all");
  const [filterAssignedTo, setFilterAssignedTo] = useState("all");
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null }[]>([]);
  const [page, setPage]                     = useState(1);
  const [pageSize, setPageSize]             = useState(20);

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
      getAreas().then(({ areas: a }) => setAreas(a));
    }
    listProfiles().then(({ profiles: p }) => setProfiles(p));
  }, [selectedArea, isSuperAdmin]);

  const filtered = useMemo(() =>
    requests.filter((r) => {
      const matchSearch    = !search || r.title.toLowerCase().includes(search.toLowerCase());
      const matchPriority  = filterPriority === "all" || r.priority === filterPriority;
      const matchStatus    = filterStatus === "all" || r.status_column_id === filterStatus;
      const matchAssigned  =
        filterAssigned === "all" ||
        (filterAssigned === "assigned_to_me" && r.assigned_to === user?.id) ||
        (filterAssigned === "created_by_me"  && r.created_by  === user?.id);
      const matchAssignedTo = filterAssignedTo === "all" || r.assigned_to === filterAssignedTo;
      return matchSearch && matchPriority && matchStatus && matchAssigned && matchAssignedTo;
    }),
    [requests, search, filterPriority, filterStatus, filterAssigned, filterAssignedTo, user?.id]
  );

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [search, filterPriority, filterStatus, filterAssigned, filterAssignedTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage   = Math.min(page, totalPages);

  const paginated = useMemo(() =>
    filtered.slice((safePage - 1) * pageSize, safePage * pageSize),
    [filtered, safePage, pageSize]
  );

  const firstItem = filtered.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const lastItem  = Math.min(safePage * pageSize, filtered.length);

  const colMap = useMemo(() => Object.fromEntries(columns.map((c) => [c.id, c])), [columns]);

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

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1080, margin: "0 auto", animation: "spIn .35s ease both" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            fontSize: 30, fontWeight: 500,
            color: "var(--foreground)",
            margin: 0, lineHeight: 1.2,
          }}>
            Solicitudes
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 4 }}>
            {filtered.length === requests.length
              ? `${requests.length} solicitudes`
              : `${filtered.length} de ${requests.length} solicitudes`}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {isSuperAdmin && (
            <select
              value={selectedArea ?? "all"}
              onChange={(e) => setSelectedArea(e.target.value === "all" ? null : e.target.value)}
              style={selectStyle}
            >
              <option value="all">Todas las áreas</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}

          {hasPermission("create_requests") && (
            <button onClick={() => setShowManual(true)} style={btnOutlineStyle}>
              <Plus size={14} /> Nueva manual
            </button>
          )}

          {hasPermission("use_ai_features") && (
            <Link to="/app/chat" style={btnCoralStyle}>
              <MessageSquare size={14} /> Nueva con IA
            </Link>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <Search
            size={14}
            style={{
              position: "absolute", left: 14, top: "50%",
              transform: "translateY(-50%)",
              color: "var(--muted-foreground)", pointerEvents: "none",
            }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por título..."
            style={{ ...filterInputStyle, paddingLeft: 38, width: "100%" }}
          />
        </div>

        <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={filterInputStyle}>
          <option value="all">Todas las prioridades</option>
          {PRIORITIES.map((p) => (
            <option key={p} value={p} style={{ textTransform: "capitalize" }}>{p}</option>
          ))}
        </select>

        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={filterInputStyle}>
          <option value="all">Todos los estados</option>
          {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)} style={filterInputStyle}>
          <option value="all">Todas</option>
          <option value="assigned_to_me">Asignadas a mí</option>
          <option value="created_by_me">Creadas por mí</option>
        </select>
        <select value={filterAssignedTo} onChange={(e) => setFilterAssignedTo(e.target.value)} style={filterInputStyle}>
          <option value="all">Asignado a: Todos</option>
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>{p.full_name ?? "Sin nombre"}</option>
          ))}
        </select>
      </div>

      {/* ── Table ── */}
      <div style={{
        background: "var(--card)",
        borderRadius: "var(--r-card, 20px)",
        border: "1px solid var(--border)",
        overflow: "hidden",
      }}>
        {/* Column headers */}
        <div style={{
          display: "grid", gridTemplateColumns: GRID,
          padding: "10px 20px",
          borderBottom: "1px solid var(--border)",
        }}>
          {["Título", "Estado", "Prioridad", "Actualizado", ""].map((h, i) => (
            <span key={i} style={{
              fontSize: 11, fontWeight: 600,
              textTransform: "uppercase" as const,
              letterSpacing: ".06em",
              color: "var(--muted-foreground)",
            }}>
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {loading ? (
          <SkeletonRows />
        ) : filtered.length === 0 ? (
          <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>
            {search || filterPriority !== "all" || filterStatus !== "all"
              ? "No hay solicitudes que coincidan con los filtros."
              : "Sin solicitudes aún. Usa el Chat IA para crear una."}
          </div>
        ) : (
          paginated.map((r, idx) => {
            const col    = r.status_column_id ? colMap[r.status_column_id] : null;
            const canDel = canDeleteAll || (canDeleteOwn && r.created_by === user?.id);

            return (
              <div
                key={r.id}
                className="sp-row"
                onClick={() => setSelectedId(r.id)}
                style={{
                  display: "grid", gridTemplateColumns: GRID,
                  padding: "14px 20px",
                  borderBottom: idx < paginated.length - 1 ? "1px solid var(--border)" : "none",
                  alignItems: "center",
                  cursor: "pointer",
                  transition: "background 120ms",
                }}
              >
                {/* Title + description */}
                <div style={{ minWidth: 0, paddingRight: 16 }}>
                  <p style={{
                    margin: 0, fontSize: 14, fontWeight: 500,
                    color: "var(--foreground)",
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                  }}>
                    {r.title}
                  </p>
                  {r.description && (
                    <p style={{
                      margin: "2px 0 0", fontSize: 12,
                      color: "var(--muted-foreground)",
                      overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {r.description}
                    </p>
                  )}
                </div>

                {/* Status */}
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  {col ? (
                    <>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: col.color, flexShrink: 0 }} />
                      <span style={{
                        fontSize: 13, color: "var(--foreground)",
                        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                      }}>
                        {col.name}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>Sin estado</span>
                  )}
                </div>

                {/* Priority pill */}
                <div>
                  <span style={{
                    display: "inline-flex", alignItems: "center",
                    padding: "3px 10px", borderRadius: 20,
                    fontSize: 11, fontWeight: 600,
                    textTransform: "capitalize",
                    ...(priStyle[r.priority] ?? {}),
                  }}>
                    {r.priority}
                  </span>
                </div>

                {/* Updated at */}
                <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                  {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale: es })}
                </span>

                {/* Actions — revealed on row hover via .sp-row .row-actions CSS */}
                <div
                  className="row-actions"
                  style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => setSelectedId(r.id)}
                    title="Ver detalle"
                    style={iconBtnStyle}
                  >
                    <ExternalLink size={13} />
                  </button>
                  {canDel && (
                    <button
                      onClick={(e) => remove(r.id, e)}
                      title="Eliminar"
                      style={{ ...iconBtnStyle, color: "#ef4444" }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ── Pagination ── */}
      {!loading && filtered.length > 0 && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          marginTop: 16, flexWrap: "wrap", gap: 12,
        }}>
          {/* Left: rows per page + range info */}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "var(--muted-foreground)" }}>
            <span>Filas por página:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              style={pageSizeSelectStyle}
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ marginLeft: 4 }}>
              {firstItem}–{lastItem} de {filtered.length}
            </span>
          </div>

          {/* Right: page navigation */}
          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
            <button
              onClick={() => setPage(1)}
              disabled={safePage === 1}
              style={pageNavBtn(safePage === 1)}
              title="Primera página"
            >
              <ChevronsLeft size={14} />
            </button>
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              style={pageNavBtn(safePage === 1)}
              title="Página anterior"
            >
              <ChevronLeft size={14} />
            </button>

            {getPageNumbers(safePage, totalPages).map((p, i) =>
              p === "..." ? (
                <span key={`e${i}`} style={{ padding: "0 6px", color: "var(--muted-foreground)", fontSize: 13 }}>…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p as number)}
                  style={pageNumBtn(p === safePage)}
                >
                  {p}
                </button>
              )
            )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              style={pageNavBtn(safePage === totalPages)}
              title="Página siguiente"
            >
              <ChevronRight size={14} />
            </button>
            <button
              onClick={() => setPage(totalPages)}
              disabled={safePage === totalPages}
              style={pageNavBtn(safePage === totalPages)}
              title="Última página"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
        </div>
      )}

      <RequestDetailModal
        requestId={selectedId}
        onClose={() => setSelectedId(null)}
        onUpdated={reload}
      />

      {showManual && (
        <ManualRequestModal
          onClose={() => setShowManual(false)}
          onCreated={reload}
        />
      )}
    </div>
  );
}

function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);

  const pages: (number | "...")[] = [1];

  if (current > 3) pages.push("...");

  const start = Math.max(2, current - 1);
  const end   = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) pages.push(i);

  if (current < total - 2) pages.push("...");
  pages.push(total);

  return pages;
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} style={{
          display: "grid", gridTemplateColumns: GRID,
          padding: "14px 20px",
          borderBottom: "1px solid var(--border)",
          alignItems: "center",
        }}>
          <div style={skBar("55%")} />
          <div style={skBar("70%")} />
          <div style={{ ...skBar(60), borderRadius: 20 }} />
          <div style={skBar("60%")} />
          <div />
        </div>
      ))}
    </>
  );
}

// ── Shared styles ──────────────────────────────────────────────

const filterInputStyle: React.CSSProperties = {
  height: 42, padding: "0 14px",
  borderRadius: "var(--r-md, 10px)",
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 13,
  cursor: "pointer", outline: "none",
  minWidth: 160, boxSizing: "border-box",
};

const selectStyle: React.CSSProperties = {
  height: 40, padding: "0 14px",
  borderRadius: "var(--r-xl, 16px)",
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 13,
  cursor: "pointer", outline: "none",
};

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
  display: "flex", alignItems: "center", gap: 7,
  height: 40, padding: "0 18px",
  borderRadius: "var(--r-xl, 16px)",
  background: "#ED5650", color: "white",
  textDecoration: "none", fontSize: 13, fontWeight: 500,
  whiteSpace: "nowrap",
};

const iconBtnStyle: React.CSSProperties = {
  width: 28, height: 28, borderRadius: 8,
  border: "none", background: "transparent",
  cursor: "pointer", display: "flex",
  alignItems: "center", justifyContent: "center",
  color: "var(--muted-foreground)",
};

const pageSizeSelectStyle: React.CSSProperties = {
  height: 32, padding: "0 10px",
  borderRadius: "var(--r-md, 10px)",
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 13,
  cursor: "pointer", outline: "none",
};

function pageNavBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 32, height: 32, borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: disabled ? "var(--muted-foreground)" : "var(--foreground)",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    opacity: disabled ? 0.45 : 1,
    transition: "background 120ms",
  };
}

function pageNumBtn(active: boolean): React.CSSProperties {
  return {
    minWidth: 32, height: 32,
    padding: "0 6px",
    borderRadius: 8,
    border: active ? "1px solid #ED5650" : "1px solid var(--border)",
    background: active ? "#ED5650" : "var(--card)",
    color: active ? "white" : "var(--foreground)",
    fontSize: 13, fontWeight: active ? 600 : 400,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 120ms",
  };
}

function skBar(w: number | string): React.CSSProperties {
  return {
    height: 14, borderRadius: 6,
    background: "var(--muted)",
    width: w,
    animation: "pulse 1.5s ease-in-out infinite",
  };
}

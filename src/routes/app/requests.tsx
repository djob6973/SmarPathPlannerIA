import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLang } from "@/lib/lang-context";
import { getRequestsData, deleteRequest, type RequestRow, type ColumnRow } from "@/lib/requests.functions";
import { getAreas, listProfiles } from "@/lib/data.functions";
import { RequestDetailModal } from "@/components/requests/request-detail-modal";
import { ManualRequestModal } from "@/components/requests/manual-request-modal";
import { toast } from "sonner";
import { Search, MessageSquare, Trash2, ExternalLink, Plus, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, X, SlidersHorizontal } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import { es, enUS, ptBR } from "date-fns/locale";

export const Route = createFileRoute("/app/requests")({
  validateSearch: (search: Record<string, unknown>): { openRequest?: string } => {
    const result: { openRequest?: string } = {};
    if (typeof search.openRequest === "string") result.openRequest = search.openRequest;
    return result;
  },
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
  const { t, lang } = useLang();
  const dateLocale = lang === "en" ? enUS : lang === "pt" ? ptBR : es;
  const { openRequest } = Route.useSearch();
  const navigate = useNavigate();
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
  const [filterAssignedTo, setFilterAssignedTo] = useState("all");
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null }[]>([]);
  const [filterCreatedFrom, setFilterCreatedFrom]       = useState("");
  const [filterCreatedTo,   setFilterCreatedTo]         = useState("");
  const [filterCompletedFrom, setFilterCompletedFrom]   = useState("");
  const [filterCompletedTo,   setFilterCompletedTo]     = useState("");
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

  // Abrir modal directamente cuando viene desde el buscador
  useEffect(() => {
    if (!loading && openRequest) {
      setSelectedId(openRequest);
      // Limpiar el param de la URL para que no se reabra al refrescar
      navigate({ to: "/app/requests", search: {}, replace: true } as any);
    }
  }, [loading, openRequest]);

  const filtered = useMemo(() =>
    requests.filter((r) => {
      const matchSearch     = !search || r.title.toLowerCase().includes(search.toLowerCase());
      const matchPriority   = filterPriority === "all" || r.priority === filterPriority;
      const matchStatus     = filterStatus === "all" || r.status_column_id === filterStatus;
      const matchAssignedTo = filterAssignedTo === "all" || r.assigned_to === filterAssignedTo;

      // Date filters — postgres.js returns Date objects, convert to ISO string first
      const createdDate    = new Date(r.created_at).toISOString().slice(0, 10);
      const completedDate  = r.completed_at ? new Date(r.completed_at).toISOString().slice(0, 10) : null;

      const matchCreatedFrom   = !filterCreatedFrom   || createdDate >= filterCreatedFrom;
      const matchCreatedTo     = !filterCreatedTo     || createdDate <= filterCreatedTo;
      const matchCompletedFrom = !filterCompletedFrom || (completedDate !== null && completedDate >= filterCompletedFrom);
      const matchCompletedTo   = !filterCompletedTo   || (completedDate !== null && completedDate <= filterCompletedTo);

      return matchSearch && matchPriority && matchStatus && matchAssignedTo
        && matchCreatedFrom && matchCreatedTo && matchCompletedFrom && matchCompletedTo;
    }),
    [requests, search, filterPriority, filterStatus, filterAssignedTo,
     filterCreatedFrom, filterCreatedTo, filterCompletedFrom, filterCompletedTo]
  );

  const activeFilterCount = [
    filterPriority !== "all",
    filterStatus !== "all",
    filterAssignedTo !== "all",
    !!filterCreatedFrom, !!filterCreatedTo,
    !!filterCompletedFrom, !!filterCompletedTo,
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    setFilterPriority("all");
    setFilterStatus("all");
    setFilterAssignedTo("all");
    setFilterCreatedFrom(""); setFilterCreatedTo("");
    setFilterCompletedFrom(""); setFilterCompletedTo("");
  };

  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!filterOpen) return;
    const handler = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [filterOpen]);

  // Reset to page 1 when filters change
  useEffect(() => { setPage(1); }, [
    search, filterPriority, filterStatus, filterAssignedTo,
    filterCreatedFrom, filterCreatedTo, filterCompletedFrom, filterCompletedTo,
  ]);

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
    if (!confirm(t("requests.deleteConfirm"))) return;
    try {
      await deleteRequest({ data: { requestId: id } });
      toast.success(t("requests.deleteSuccess"));
      reload();
    } catch (err: any) {
      toast.error(err?.message ?? t("requests.deleteError"));
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
            {t("requests.title")}
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 4 }}>
            {filtered.length === requests.length
              ? t("requests.countAll", { n: requests.length })
              : t("requests.countFiltered", { n: filtered.length, total: requests.length })}
          </p>
        </div>

        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {isSuperAdmin && (
            <select
              value={selectedArea ?? "all"}
              onChange={(e) => setSelectedArea(e.target.value === "all" ? null : e.target.value)}
              style={selectStyle}
            >
              <option value="all">{t("common.allAreas")}</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}

          {hasPermission("create_requests") && (
            <button onClick={() => setShowManual(true)} style={btnOutlineStyle}>
              <Plus size={14} /> {t("requests.newManual")}
            </button>
          )}

          {hasPermission("use_ai_features") && (
            <Link to="/app/chat" style={btnCoralStyle}>
              <MessageSquare size={14} /> {t("requests.newWithAI")}
            </Link>
          )}
        </div>
      </div>

      {/* ── Search + Filter ── */}
      <div style={{ display: "flex", gap: 10, marginBottom: 18, alignItems: "center" }}>
        {/* Search bar */}
        <div style={{ position: "relative", flex: 1 }}>
          <Search size={14} style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "var(--muted-foreground)", pointerEvents: "none" }} />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("requests.searchPlaceholder")}
            style={{ ...filterInputStyle, paddingLeft: 38, width: "100%" }}
          />
        </div>

        {/* Filter button + popover */}
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
                    {PRIORITIES.map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
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
                  {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? t("common.noName")}</option>)}
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
          {[t("requests.colTitle"), t("requests.colStatus"), t("requests.colPriority"), t("requests.colUpdated"), ""].map((h, i) => (
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
            {search || activeFilterCount > 0
              ? t("requests.noResults")
              : t("requests.empty")}
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
                    <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>{t("common.noStatus")}</span>
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
                  {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale: dateLocale })}
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
            <span>{t("common.rowsPerPage")}</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              style={pageSizeSelectStyle}
            >
              {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <span style={{ marginLeft: 4 }}>
              {firstItem}–{lastItem} {t("common.of")} {filtered.length}
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

const popoverLabelStyle: React.CSSProperties = {
  display: "block", fontSize: 11, fontWeight: 600,
  textTransform: "uppercase", letterSpacing: ".06em",
  color: "var(--muted-foreground)", marginBottom: 6,
};

const popoverSubLabelStyle: React.CSSProperties = {
  display: "block", fontSize: 10,
  color: "var(--muted-foreground)", marginBottom: 4,
};

// filterInputStyle override for inside the popover — removes minWidth so grid columns constrain correctly
const popoverInputStyle: React.CSSProperties = {
  height: 38, padding: "0 10px",
  borderRadius: "var(--r-md, 10px)",
  border: "1px solid var(--border)",
  background: "var(--background)",
  color: "var(--foreground)",
  fontSize: 13,
  cursor: "pointer", outline: "none",
  minWidth: 0, width: "100%", boxSizing: "border-box",
};

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

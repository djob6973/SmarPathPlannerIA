import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getRequestsData, type RequestRow, type ColumnRow } from "@/lib/requests.functions";
import { getAreas } from "@/lib/data.functions";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingUp, CheckCircle2, Clock, Kanban, GitBranch, Link2,
  ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
} from "lucide-react";

export const Route = createFileRoute("/app/analytics")({
  component: AnalyticsPage,
});

type Request = Pick<RequestRow,
  "id" | "title" | "priority" | "status_column_id" |
  "created_at" | "updated_at" | "completed_at" | "parent_request_id"
>;
type Column = Pick<ColumnRow, "id" | "name" | "color" | "is_completed">;

const CORAL      = "#ED5650";
const GREEN      = "#9DDD05";
const GREEN_TEXT = "#7AAE1B";
const INDIGO     = "#6366F1";
const INDIGO_BG  = "rgba(99,102,241,.12)";
const INIT_PAGE_SIZE = 10;

const priStyle: Record<string, React.CSSProperties> = {
  urgent: { background: "rgba(239,68,68,.12)",   color: "#ef4444", border: "1px solid rgba(239,68,68,.25)"   },
  high:   { background: "rgba(249,115,22,.12)",  color: "#f97316", border: "1px solid rgba(249,115,22,.25)"  },
  medium: { background: "rgba(234,179,8,.12)",   color: "#ca8a04", border: "1px solid rgba(234,179,8,.25)"   },
  low:    { background: "rgba(100,116,139,.12)", color: "#64748b", border: "1px solid rgba(100,116,139,.25)" },
};

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#EF4444", high: "#F97316", medium: "#EAB308", low: "#6366F1",
};
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent", high: "High", medium: "Medium", low: "Low",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function buildByCol(subset: Request[], columns: Column[]) {
  return columns.map(c => ({
    name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name,
    count: subset.filter(r => r.status_column_id === c.id).length,
    color: c.color,
  }));
}

function buildPriorityData(subset: Request[]) {
  const data = (["urgent", "high", "medium", "low"] as const).map(p => ({
    key: p, label: PRIORITY_LABELS[p],
    value: subset.filter(r => r.priority === p).length,
    color: PRIORITY_COLORS[p],
  })).filter(d => d.value > 0);
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  let cum = 0;
  const conic = data.length > 0
    ? `conic-gradient(${data.map(d => {
        const pct = (d.value / total) * 100;
        const part = `${d.color} ${cum.toFixed(1)}% ${(cum + pct).toFixed(1)}%`;
        cum += pct;
        return part;
      }).join(", ")})`
    : "var(--muted)";
  return { data, total, conic };
}

function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - ys.getTime()) / 86400000 + 1) / 7);
}

function buildCompletedOverTime(
  completedSubset: Request[],
  period: "week" | "month" | "quarter",
  year: number,
) {
  const now = new Date();
  const isCurrentYear = year === now.getFullYear();
  if (period === "week") {
    const totalWeeks = isCurrentYear ? isoWeek(now) : 52;
    return Array.from({ length: Math.min(totalWeeks, 26) }, (_, i) => ({
      name: `S${i + 1}`,
      completadas: completedSubset.filter(r => {
        const rd = new Date(r.completed_at ?? r.updated_at);
        return rd.getFullYear() === year && isoWeek(rd) === i + 1;
      }).length,
    }));
  }
  if (period === "month") {
    const months = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
    return months.map((name, i) => ({
      name,
      completadas: completedSubset.filter(r => {
        const rd = new Date(r.completed_at ?? r.updated_at);
        return rd.getFullYear() === year && rd.getMonth() === i;
      }).length,
    }));
  }
  return ["Q1","Q2","Q3","Q4"].map((name, i) => ({
    name,
    completadas: completedSubset.filter(r => {
      const rd = new Date(r.completed_at ?? r.updated_at);
      return rd.getFullYear() === year && Math.floor(rd.getMonth() / 3) === i;
    }).length,
  }));
}

// ── Page ──────────────────────────────────────────────────────────────────────

function AnalyticsPage() {
  const { areaId, isSuperAdmin, hasPermission } = useAuth();

  if (!hasPermission("view_analytics")) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Sin acceso</p>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>No tienes permiso para ver el módulo de analítica.</p>
      </div>
    );
  }

  const [columns, setColumns]           = useState<Column[]>([]);
  const [requests, setRequests]         = useState<Request[]>([]);
  const [loading, setLoading]           = useState(true);
  const [mounted, setMounted]           = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [areas, setAreas]               = useState<any[]>([]);
  const [period, setPeriod]             = useState<"week" | "month" | "quarter">("month");
  const [year, setYear]                 = useState<number>(new Date().getFullYear());
  const [activeView, setActiveView]     = useState<"solicitudes" | "iniciativas">("solicitudes");
  const [initPage, setInitPage]         = useState(1);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const effectiveAreaId = isSuperAdmin ? selectedArea : areaId;
    setLoading(true);
    getRequestsData({ data: { areaId: effectiveAreaId } }).then(({ columns: cols, requests: reqs }) => {
      setColumns(cols);
      setRequests(reqs);
      setLoading(false);
    });
    if (isSuperAdmin) getAreas().then(({ areas: data }) => setAreas(data));
  }, [areaId, isSuperAdmin, selectedArea]);

  // Reset init pagination when switching views
  useEffect(() => { setInitPage(1); }, [activeView]);

  if (!mounted || loading) return <Skeleton />;

  // ── Shared base data ────────────────────────────────────────────────────────
  const completedIds = new Set(columns.filter(c => c.is_completed).map(c => c.id));
  const initiatives  = requests.filter(r => r.parent_request_id === null);
  const linkedReqs   = requests.filter(r => r.parent_request_id !== null);

  // ── Solicitudes data ────────────────────────────────────────────────────────
  const solCompleted   = requests.filter(r => r.status_column_id && completedIds.has(r.status_column_id)).length;
  const solInProgress  = requests.filter(r => r.status_column_id && !completedIds.has(r.status_column_id)).length;
  const solPending     = requests.filter(r => !r.status_column_id).length;
  const solRate        = requests.length > 0 ? Math.round((solCompleted / requests.length) * 100) : 0;
  const solByCol       = buildByCol(requests, columns);
  const solMaxByCol    = Math.max(...solByCol.map(c => c.count), 1);
  const solPri         = buildPriorityData(requests);
  const solCompletedReqs = requests.filter(r => r.status_column_id && completedIds.has(r.status_column_id));

  const activityData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const ds = d.toISOString().slice(0, 10);
    return {
      name: d.toLocaleDateString("es", { weekday: "short" }),
      count: requests.filter(r => new Date(r.created_at).toISOString().slice(0, 10) === ds).length,
    };
  });
  const maxAct = Math.max(...activityData.map(d => d.count), 1);

  // ── Iniciativas data ────────────────────────────────────────────────────────
  const initCompleted  = initiatives.filter(r => r.status_column_id && completedIds.has(r.status_column_id)).length;
  const initInProgress = initiatives.filter(r => r.status_column_id && !completedIds.has(r.status_column_id)).length;
  const initPending    = initiatives.filter(r => !r.status_column_id).length;
  const initRate       = initiatives.length > 0 ? Math.round((initCompleted / initiatives.length) * 100) : 0;
  const initByCol      = buildByCol(initiatives, columns);
  const initMaxByCol   = Math.max(...initByCol.map(c => c.count), 1);
  const initPri        = buildPriorityData(initiatives);
  const initCompletedReqs = initiatives.filter(r => r.status_column_id && completedIds.has(r.status_column_id));

  const initiativesWithProgress = initiatives
    .map(init => {
      const children          = linkedReqs.filter(r => r.parent_request_id === init.id);
      const completedChildren = children.filter(r => r.status_column_id && completedIds.has(r.status_column_id));
      const progressPct       = children.length > 0
        ? Math.round((completedChildren.length / children.length) * 100)
        : null;
      const col = init.status_column_id ? columns.find(c => c.id === init.status_column_id) ?? null : null;
      return { ...init, childCount: children.length, completedChildCount: completedChildren.length, progressPct, col };
    })
    .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

  const initTotalPages  = Math.max(1, Math.ceil(initiativesWithProgress.length / INIT_PAGE_SIZE));
  const initSafePage    = Math.min(initPage, initTotalPages);
  const initPagedList   = initiativesWithProgress.slice((initSafePage - 1) * INIT_PAGE_SIZE, initSafePage * INIT_PAGE_SIZE);
  const initFirstItem   = initiativesWithProgress.length === 0 ? 0 : (initSafePage - 1) * INIT_PAGE_SIZE + 1;
  const initLastItem    = Math.min(initSafePage * INIT_PAGE_SIZE, initiativesWithProgress.length);

  // ── Available years (union across both views) ───────────────────────────────
  const availableYears = Array.from(new Set([
    ...solCompletedReqs.map(r => new Date(r.completed_at ?? r.updated_at).getFullYear()),
    ...initCompletedReqs.map(r => new Date(r.completed_at ?? r.updated_at).getFullYear()),
  ])).sort((a, b) => b - a);
  if (!availableYears.includes(new Date().getFullYear())) availableYears.unshift(new Date().getFullYear());

  // ── Current view's computed chart data ──────────────────────────────────────
  const isSol          = activeView === "solicitudes";
  const kpiTotal       = isSol ? requests.length    : initiatives.length;
  const kpiInProgress  = isSol ? solInProgress      : initInProgress;
  const kpiPending     = isSol ? solPending         : initPending;
  const kpiCompleted   = isSol ? solCompleted       : initCompleted;
  const kpiRate        = isSol ? solRate            : initRate;
  const kpiLabel       = isSol ? "solicitudes"      : "iniciativas";
  const kpiTotalLabel  = isSol ? "Total solicitudes" : "Total iniciativas";
  const accentColor    = isSol ? CORAL              : INDIGO;
  const accentBg       = isSol ? "rgba(237,86,80,.12)" : INDIGO_BG;
  const activeByCol    = isSol ? solByCol           : initByCol;
  const activeMaxByCol = isSol ? solMaxByCol        : initMaxByCol;
  const activePri      = isSol ? solPri             : initPri;
  const activeCompleted = isSol ? solCompletedReqs  : initCompletedReqs;
  const completedOverTime = buildCompletedOverTime(activeCompleted, period, year);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: "36px 40px 64px", maxWidth: 1180, margin: "0 auto", animation: "spIn .35s ease both" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 28, flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            fontSize: 30, fontWeight: 500, color: "var(--foreground)", margin: 0, lineHeight: 1.2,
          }}>
            Analítica
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 4 }}>
            Métricas y estado del roadmap
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Toggle Solicitudes / Iniciativas */}
          <div style={{ display: "flex", background: "var(--muted)", borderRadius: "var(--r-xl, 16px)", padding: 3 }}>
            {([
              { key: "solicitudes", label: "Solicitudes", icon: <Kanban size={14} />,    accent: CORAL   },
              { key: "iniciativas", label: "Iniciativas", icon: <GitBranch size={14} />, accent: INDIGO  },
            ] as const).map(v => (
              <button
                key={v.key}
                onClick={() => setActiveView(v.key)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "7px 16px", borderRadius: 13,
                  border: "none", fontSize: 13, fontWeight: 500, cursor: "pointer",
                  background: activeView === v.key ? "var(--card)" : "transparent",
                  color: activeView === v.key ? v.accent : "var(--muted-foreground)",
                  boxShadow: activeView === v.key ? "0 1px 4px rgba(0,0,0,.1)" : "none",
                  transition: "all 150ms",
                }}
              >
                {v.icon} {v.label}
              </button>
            ))}
          </div>

          {/* Area selector (super admin) */}
          {isSuperAdmin && (
            <select
              value={selectedArea ?? "all"}
              onChange={e => setSelectedArea(e.target.value === "all" ? null : e.target.value)}
              style={sel}
            >
              <option value="all">Todas las áreas</option>
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* ── KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 20 }}>
        {[
          { label: kpiTotalLabel,  value: kpiTotal,      icon: isSol ? <Kanban size={18} color={CORAL} />          : <GitBranch size={18} color={INDIGO} />,         iconBg: accentBg              },
          { label: "En progreso",  value: kpiInProgress, icon: <TrendingUp size={18} color="var(--muted-foreground)" />, iconBg: "var(--muted)"                     },
          { label: "Pendientes",   value: kpiPending,    icon: <Clock size={18} color="var(--muted-foreground)" />,       iconBg: "var(--muted)"                     },
          { label: "Completadas",  value: kpiCompleted,  icon: <CheckCircle2 size={18} color={GREEN_TEXT} />,              iconBg: "rgba(157,221,5,.15)"              },
        ].map(k => (
          <div key={k.label} style={card}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 500, color: "var(--muted-foreground)", margin: 0 }}>{k.label}</p>
                <p style={{ fontSize: 36, fontWeight: 700, color: "var(--foreground)", margin: "8px 0 0", lineHeight: 1 }}>{k.value}</p>
              </div>
              <div style={{
                width: 40, height: 40, borderRadius: "var(--r-md, 10px)",
                background: k.iconBg,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                {k.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Tasa de completado ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>Tasa de completado</p>
            <p style={{ fontSize: 12, color: "var(--muted-foreground)", margin: "4px 0 0" }}>
              {kpiCompleted} de {kpiTotal} {kpiLabel} completadas
            </p>
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, color: isSol ? GREEN_TEXT : INDIGO }}>{kpiRate}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "var(--muted)", overflow: "hidden" }}>
          <div style={{ width: `${kpiRate}%`, height: "100%", borderRadius: 99, background: isSol ? GREEN : INDIGO, transition: "width 700ms" }} />
        </div>
      </div>

      {/* ── Por estado + Por prioridad ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        <div style={card}>
          <h3 style={ctitle}>Por estado</h3>
          {activeByCol.every(c => c.count === 0) ? <EmptyChart /> : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 180, paddingTop: 16 }}>
              {activeByCol.map((c, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{c.count}</span>
                  <div style={{
                    width: "100%", minWidth: 14,
                    height: Math.max((c.count / activeMaxByCol) * 120, c.count > 0 ? 6 : 0),
                    background: c.color, borderRadius: "5px 5px 0 0",
                  }} />
                  <span style={{ fontSize: 10, color: "var(--muted-foreground)", textAlign: "center" as const, lineHeight: 1.2, maxWidth: 70, wordBreak: "break-word" as const }}>
                    {c.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={card}>
          <h3 style={ctitle}>Por prioridad</h3>
          {activePri.data.length === 0 ? <EmptyChart /> : (
            <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 8 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 130, height: 130, borderRadius: "50%", background: activePri.conic }} />
                <div style={{ position: "absolute", inset: 22, borderRadius: "50%", background: "var(--card)" }} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
                {activePri.data.map(d => (
                  <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--foreground)" }}>{d.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>
                      {Math.round((d.value / activePri.total) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Completados en el tiempo ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ ...ctitle, margin: 0 }}>
            {isSol ? "Solicitudes completadas" : "Iniciativas completadas"}
          </h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select
              value={String(year)}
              onChange={e => setYear(Number(e.target.value))}
              style={{ ...sel, height: 32, fontSize: 12, padding: "0 10px" }}
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ display: "flex", gap: 2, background: "var(--muted)", borderRadius: "var(--r-md, 10px)", padding: 3 }}>
              {(["week", "month", "quarter"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  style={{
                    padding: "4px 13px", borderRadius: 7,
                    border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer",
                    background: period === p ? "var(--card)" : "transparent",
                    color: period === p ? "var(--foreground)" : "var(--muted-foreground)",
                    boxShadow: period === p ? "0 1px 3px rgba(0,0,0,.08)" : "none",
                    transition: "all 120ms",
                  }}
                >
                  {p === "week" ? "Semana" : p === "month" ? "Mes" : "Trimestre"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div style={{ height: 200 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={completedOverTime} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={accentColor} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={accentColor} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" fontSize={11} tick={{ fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} fontSize={11} tick={{ fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 10, fontSize: 12, color: "var(--foreground)" }}
                formatter={(v: any) => [v, "Completadas"]}
              />
              <Area
                type="monotone" dataKey="completadas"
                stroke={accentColor} strokeWidth={2}
                fill="url(#areaGrad)"
                dot={{ fill: accentColor, r: 4, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: accentColor }}
                name="Completadas"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Solicitudes: Actividad últimos 7 días ── */}
      {isSol && (
        <div style={card}>
          <h3 style={ctitle}>Actividad — últimos 7 días</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {activityData.map((d, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ fontSize: 12, color: "var(--muted-foreground)", width: 34, textAlign: "right" as const, textTransform: "capitalize" as const }}>
                  {d.name}
                </span>
                <div style={{ flex: 1, height: 10, borderRadius: 5, background: "var(--muted)", overflow: "hidden" }}>
                  <div style={{ width: `${(d.count / maxAct) * 100}%`, height: "100%", borderRadius: 5, background: "rgba(237,86,80,.7)", transition: "width 600ms" }} />
                </div>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", width: 20, textAlign: "right" as const }}>
                  {d.count}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Iniciativas: Avance por iniciativa (paginado) ── */}
      {!isSol && (
        <div style={card}>
          <h3 style={ctitle}>Avance por iniciativa</h3>

          {initiativesWithProgress.length === 0 ? (
            <EmptyChart />
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                {initPagedList.map((init, idx) => (
                  <div
                    key={init.id}
                    style={{
                      padding: "14px 0",
                      borderBottom: idx < initPagedList.length - 1 ? "1px solid var(--border)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: init.childCount > 0 ? 10 : 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: init.col ? init.col.color : "var(--muted-foreground)" }} />
                      <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: "var(--foreground)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                        {init.title}
                      </span>
                      {init.col && (
                        <span style={{ fontSize: 11, color: "var(--muted-foreground)", flexShrink: 0 }}>{init.col.name}</span>
                      )}
                      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 99, flexShrink: 0, ...(priStyle[init.priority] ?? {}) }}>
                        {PRIORITY_LABELS[init.priority] ?? init.priority}
                      </span>
                      <span style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "var(--muted-foreground)", flexShrink: 0 }}>
                        <Link2 size={11} />
                        {init.childCount > 0 ? `${init.completedChildCount}/${init.childCount}` : "0 vinculadas"}
                      </span>
                      {init.progressPct !== null && (
                        <span style={{ fontSize: 12, fontWeight: 700, color: INDIGO, flexShrink: 0, minWidth: 32, textAlign: "right" as const }}>
                          {init.progressPct}%
                        </span>
                      )}
                    </div>
                    {init.childCount > 0 && (
                      <div style={{ height: 5, borderRadius: 99, background: "var(--muted)", overflow: "hidden", marginLeft: 18 }}>
                        <div style={{
                          width: `${init.progressPct ?? 0}%`, height: "100%", borderRadius: 99,
                          background: (init.progressPct ?? 0) === 100 ? GREEN : INDIGO,
                          transition: "width 600ms",
                        }} />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {initiativesWithProgress.length > INIT_PAGE_SIZE && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16, paddingTop: 16, borderTop: "1px solid var(--border)" }}>
                  <span style={{ fontSize: 13, color: "var(--muted-foreground)" }}>
                    {initFirstItem}–{initLastItem} de {initiativesWithProgress.length}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                    <button onClick={() => setInitPage(1)} disabled={initSafePage === 1} style={pageNavBtn(initSafePage === 1)} title="Primera">
                      <ChevronsLeft size={14} />
                    </button>
                    <button onClick={() => setInitPage(p => Math.max(1, p - 1))} disabled={initSafePage === 1} style={pageNavBtn(initSafePage === 1)} title="Anterior">
                      <ChevronLeft size={14} />
                    </button>
                    {getPageNumbers(initSafePage, initTotalPages).map((p, i) =>
                      p === "..." ? (
                        <span key={`e${i}`} style={{ padding: "0 6px", color: "var(--muted-foreground)", fontSize: 13 }}>…</span>
                      ) : (
                        <button key={p} onClick={() => setInitPage(p as number)} style={pageNumBtn(p === initSafePage, INDIGO)}>
                          {p}
                        </button>
                      )
                    )}
                    <button onClick={() => setInitPage(p => Math.min(initTotalPages, p + 1))} disabled={initSafePage === initTotalPages} style={pageNavBtn(initSafePage === initTotalPages)} title="Siguiente">
                      <ChevronRight size={14} />
                    </button>
                    <button onClick={() => setInitPage(initTotalPages)} disabled={initSafePage === initTotalPages} style={pageNavBtn(initSafePage === initTotalPages)} title="Última">
                      <ChevronsRight size={14} />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ── Pagination helpers ────────────────────────────────────────────────────────

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

function pageNavBtn(disabled: boolean): React.CSSProperties {
  return {
    width: 30, height: 30, borderRadius: 7,
    border: "1px solid var(--border)",
    background: "var(--card)",
    color: disabled ? "var(--muted-foreground)" : "var(--foreground)",
    cursor: disabled ? "not-allowed" : "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    opacity: disabled ? 0.45 : 1,
    transition: "background 120ms",
  };
}

function pageNumBtn(active: boolean, accent: string): React.CSSProperties {
  return {
    minWidth: 30, height: 30, padding: "0 6px", borderRadius: 7,
    border: active ? `1px solid ${accent}` : "1px solid var(--border)",
    background: active ? accent : "var(--card)",
    color: active ? "white" : "var(--foreground)",
    fontSize: 13, fontWeight: active ? 600 : 400,
    cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center",
    transition: "background 120ms",
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div style={{ padding: "36px 40px 64px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 28 }}>
        <div style={{ height: 52, width: 180, borderRadius: 12, background: "var(--muted)", animation: "pulse 1.5s ease-in-out infinite" }} />
        <div style={{ height: 44, width: 260, borderRadius: 99, background: "var(--muted)", animation: "pulse 1.5s ease-in-out infinite" }} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 20, marginBottom: 20 }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} style={{ height: 96, borderRadius: "var(--r-card, 20px)", background: "var(--muted)", animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
      </div>
      <div style={{ height: 64, borderRadius: "var(--r-card, 20px)", background: "var(--muted)", marginBottom: 20, animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} style={{ height: 260, borderRadius: "var(--r-card, 20px)", background: "var(--muted)", animation: "pulse 1.5s ease-in-out infinite" }} />
        ))}
      </div>
      <div style={{ height: 280, borderRadius: "var(--r-card, 20px)", background: "var(--muted)", marginBottom: 20, animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ height: 200, borderRadius: "var(--r-card, 20px)", background: "var(--muted)", animation: "pulse 1.5s ease-in-out infinite" }} />
    </div>
  );
}

function EmptyChart() {
  return (
    <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--muted-foreground)", fontSize: 13 }}>
      Sin datos
    </div>
  );
}

// ── Shared styles ─────────────────────────────────────────────────────────────

const card: React.CSSProperties = {
  background: "var(--card)",
  borderRadius: "var(--r-card, 20px)",
  border: "1px solid var(--border)",
  padding: "24px",
};

const ctitle: React.CSSProperties = {
  fontSize: 14, fontWeight: 600,
  color: "var(--foreground)",
  margin: "0 0 20px",
};

const sel: React.CSSProperties = {
  height: 36, padding: "0 14px",
  borderRadius: "var(--r-xl, 16px)",
  border: "1px solid var(--border)",
  background: "var(--card)",
  color: "var(--foreground)",
  fontSize: 13, cursor: "pointer", outline: "none",
};

import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getRequestsData, type RequestRow, type ColumnRow } from "@/lib/requests.functions";
import { getAreas } from "@/lib/data.functions";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { TrendingUp, CheckCircle2, Clock, Kanban } from "lucide-react";

export const Route = createFileRoute("/app/analytics")({
  component: AnalyticsPage,
});

type Request = Pick<RequestRow, "id" | "priority" | "status_column_id" | "created_at" | "updated_at">;
type Column  = Pick<ColumnRow,  "id" | "name" | "color" | "is_completed">;

const CORAL = "#ED5650";
const GREEN = "#9DDD05";
const GREEN_TEXT = "#7AAE1B";

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#EF4444", high: "#F97316", medium: "#EAB308", low: "#6366F1",
};
const PRIORITY_LABELS: Record<string, string> = {
  urgent: "Urgent", high: "High", medium: "Medium", low: "Low",
};

function AnalyticsPage() {
  const { areaId, isSuperAdmin } = useAuth();
  const [columns, setColumns]             = useState<Column[]>([]);
  const [requests, setRequests]           = useState<Request[]>([]);
  const [loading, setLoading]             = useState(true);
  const [mounted, setMounted]             = useState(false);
  const [selectedArea, setSelectedArea]   = useState<string | null>(null);
  const [areas, setAreas]                 = useState<any[]>([]);
  const [completedPeriod, setCompletedPeriod] = useState<"week" | "month" | "quarter">("month");
  const [selectedYear, setSelectedYear]   = useState<number>(new Date().getFullYear());

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const effectiveAreaId = isSuperAdmin ? selectedArea : areaId;
    setLoading(true);
    getRequestsData({ data: { areaId: effectiveAreaId } }).then(({ columns: cols, requests: reqs }) => {
      setColumns(cols);
      setRequests(reqs);
      setLoading(false);
    });
    if (isSuperAdmin) {
      getAreas().then(({ areas: data }) => setAreas(data));
    }
  }, [areaId, isSuperAdmin, selectedArea]);

  if (!mounted || loading) return <Skeleton />;

  /* ── KPI computations ── */
  const completedIds = new Set(columns.filter(c => c.is_completed).map(c => c.id));
  const completed    = requests.filter(r => r.status_column_id && completedIds.has(r.status_column_id)).length;
  const inProgress   = requests.filter(r => r.status_column_id && !completedIds.has(r.status_column_id)).length;
  const pending      = requests.filter(r => !r.status_column_id).length;
  const completionRate = requests.length > 0 ? Math.round((completed / requests.length) * 100) : 0;

  /* ── Bar chart — Por estado ── */
  const byCol    = columns.map(c => ({
    name: c.name.length > 14 ? c.name.slice(0, 14) + "…" : c.name,
    count: requests.filter(r => r.status_column_id === c.id).length,
    color: c.color,
  }));
  const maxByCol = Math.max(...byCol.map(c => c.count), 1);

  /* ── Donut chart — Por prioridad ── */
  const priorityData = (["urgent", "high", "medium", "low"] as const).map(p => ({
    key: p, label: PRIORITY_LABELS[p],
    value: requests.filter(r => r.priority === p).length,
    color: PRIORITY_COLORS[p],
  })).filter(d => d.value > 0);
  const donutTotal = priorityData.reduce((s, d) => s + d.value, 0) || 1;

  let cum = 0;
  const conicGradient = priorityData.length > 0
    ? `conic-gradient(${priorityData.map(d => {
        const pct = (d.value / donutTotal) * 100;
        const part = `${d.color} ${cum.toFixed(1)}% ${(cum + pct).toFixed(1)}%`;
        cum += pct;
        return part;
      }).join(", ")})`
    : "var(--muted)";

  /* ── Area chart — Proyectos completados ── */
  const completedRequests = requests.filter(r => r.status_column_id && completedIds.has(r.status_column_id));

  const isoWeek = (date: Date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
    const ys = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - ys.getTime()) / 86400000 + 1) / 7);
  };

  const availableYears = Array.from(
    new Set(completedRequests.map(r => new Date(r.updated_at).getFullYear()))
  ).sort((a, b) => b - a);
  if (!availableYears.includes(new Date().getFullYear())) availableYears.unshift(new Date().getFullYear());

  const completedOverTime = (() => {
    const now = new Date();
    const isCurrentYear = selectedYear === now.getFullYear();
    if (completedPeriod === "week") {
      const totalWeeks = isCurrentYear ? isoWeek(now) : 52;
      return Array.from({ length: Math.min(totalWeeks, 26) }, (_, i) => ({
        name: `S${i + 1}`,
        completadas: completedRequests.filter(r => {
          const rd = new Date(r.updated_at);
          return rd.getFullYear() === selectedYear && isoWeek(rd) === i + 1;
        }).length,
      }));
    }
    if (completedPeriod === "month") {
      const months = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
      return months.map((name, i) => ({
        name,
        completadas: completedRequests.filter(r => {
          const rd = new Date(r.updated_at);
          return rd.getFullYear() === selectedYear && rd.getMonth() === i;
        }).length,
      }));
    }
    return ["Q1", "Q2", "Q3", "Q4"].map((name, i) => ({
      name,
      completadas: completedRequests.filter(r => {
        const rd = new Date(r.updated_at);
        return rd.getFullYear() === selectedYear && Math.floor(rd.getMonth() / 3) === i;
      }).length,
    }));
  })();

  /* ── Actividad bars ── */
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

  return (
    <div style={{ padding: "36px 40px 64px", maxWidth: 1180, margin: "0 auto", animation: "spIn .35s ease both" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 32 }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-display, 'Space Grotesk', sans-serif)",
            fontSize: 30, fontWeight: 500, color: "var(--foreground)", margin: 0, lineHeight: 1.2,
          }}>
            Analítica
          </h1>
          <p style={{ fontSize: 14, color: "var(--muted-foreground)", marginTop: 6 }}>
            Métricas y estado del roadmap
          </p>
        </div>
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

      {/* ── KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 20 }}>
        {[
          { label: "Total solicitudes", value: requests.length, icon: <Kanban size={18} color={CORAL} />,                      iconBg: "rgba(237,86,80,.12)"  },
          { label: "En progreso",       value: inProgress,      icon: <TrendingUp size={18} color="var(--muted-foreground)" />, iconBg: "var(--muted)"        },
          { label: "Pendientes",        value: pending,         icon: <Clock size={18} color="var(--muted-foreground)" />,      iconBg: "var(--muted)"        },
          { label: "Completadas",       value: completed,       icon: <CheckCircle2 size={18} color={GREEN_TEXT} />,           iconBg: "rgba(157,221,5,.15)" },
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
              {completed} de {requests.length} solicitudes completadas
            </p>
          </div>
          <span style={{ fontSize: 28, fontWeight: 700, color: GREEN_TEXT }}>{completionRate}%</span>
        </div>
        <div style={{ height: 8, borderRadius: 99, background: "var(--muted)", overflow: "hidden" }}>
          <div style={{ width: `${completionRate}%`, height: "100%", borderRadius: 99, background: GREEN, transition: "width 700ms" }} />
        </div>
      </div>

      {/* ── Two-column charts ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>

        {/* Por estado — custom bar chart */}
        <div style={card}>
          <h3 style={ctitle}>Por estado</h3>
          {byCol.length === 0 ? <EmptyChart /> : (
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, height: 180, paddingTop: 16 }}>
              {byCol.map((c, i) => (
                <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", height: "100%", justifyContent: "flex-end", gap: 6 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--foreground)" }}>{c.count}</span>
                  <div style={{
                    width: "100%", minWidth: 14,
                    height: Math.max((c.count / maxByCol) * 120, c.count > 0 ? 6 : 0),
                    background: c.color,
                    borderRadius: "5px 5px 0 0",
                  }} />
                  <span style={{
                    fontSize: 10, color: "var(--muted-foreground)",
                    textAlign: "center" as const, lineHeight: 1.2, maxWidth: 70,
                    wordBreak: "break-word" as const,
                  }}>
                    {c.name}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Por prioridad — CSS conic donut */}
        <div style={card}>
          <h3 style={ctitle}>Por prioridad</h3>
          {priorityData.length === 0 ? <EmptyChart /> : (
            <div style={{ display: "flex", alignItems: "center", gap: 28, marginTop: 8 }}>
              <div style={{ position: "relative", flexShrink: 0 }}>
                <div style={{ width: 130, height: 130, borderRadius: "50%", background: conicGradient }} />
                <div style={{ position: "absolute", inset: 22, borderRadius: "50%", background: "var(--card)" }} />
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 11 }}>
                {priorityData.map(d => (
                  <div key={d.key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: "50%", background: d.color, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: 13, color: "var(--foreground)" }}>{d.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)" }}>
                      {Math.round((d.value / donutTotal) * 100)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Proyectos completados — AreaChart coral ── */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 10 }}>
          <h3 style={{ ...ctitle, margin: 0 }}>Proyectos completados</h3>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <select
              value={String(selectedYear)}
              onChange={e => setSelectedYear(Number(e.target.value))}
              style={{ ...sel, height: 32, fontSize: 12, padding: "0 10px" }}
            >
              {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <div style={{ display: "flex", gap: 2, background: "var(--muted)", borderRadius: "var(--r-md, 10px)", padding: 3 }}>
              {(["week", "month", "quarter"] as const).map(p => (
                <button
                  key={p}
                  onClick={() => setCompletedPeriod(p)}
                  style={{
                    padding: "4px 13px", borderRadius: 7,
                    border: "none", fontSize: 12, fontWeight: 500, cursor: "pointer",
                    background: completedPeriod === p ? "var(--card)" : "transparent",
                    color: completedPeriod === p ? "var(--foreground)" : "var(--muted-foreground)",
                    boxShadow: completedPeriod === p ? "0 1px 3px rgba(0,0,0,.08)" : "none",
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
                <linearGradient id="coralGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={CORAL} stopOpacity={0.22} />
                  <stop offset="95%" stopColor={CORAL} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="name" fontSize={11} tick={{ fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <YAxis allowDecimals={false} fontSize={11} tick={{ fill: "var(--muted-foreground)" }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--card)", border: "1px solid var(--border)",
                  borderRadius: 10, fontSize: 12, color: "var(--foreground)",
                }}
                formatter={(v: any) => [v, "Completadas"]}
              />
              <Area
                type="monotone"
                dataKey="completadas"
                stroke={CORAL}
                strokeWidth={2}
                fill="url(#coralGrad)"
                dot={{ fill: CORAL, r: 4, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: CORAL }}
                name="Completadas"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Actividad — últimos 7 días ── */}
      <div style={card}>
        <h3 style={ctitle}>Actividad — últimos 7 días</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {activityData.map((d, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{
                fontSize: 12, color: "var(--muted-foreground)",
                width: 34, textAlign: "right" as const, textTransform: "capitalize" as const,
              }}>
                {d.name}
              </span>
              <div style={{ flex: 1, height: 10, borderRadius: 5, background: "var(--muted)", overflow: "hidden" }}>
                <div style={{
                  width: `${(d.count / maxAct) * 100}%`,
                  height: "100%", borderRadius: 5,
                  background: "rgba(237,86,80,.7)",
                  transition: "width 600ms",
                }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "var(--foreground)", width: 20, textAlign: "right" as const }}>
                {d.count}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function Skeleton() {
  return (
    <div style={{ padding: "36px 40px 64px", maxWidth: 1180, margin: "0 auto" }}>
      <div style={{ height: 52, width: 200, borderRadius: 12, background: "var(--muted)", marginBottom: 32, animation: "pulse 1.5s ease-in-out infinite" }} />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 20, marginBottom: 20 }}>
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
    <div style={{
      height: 160, display: "flex", alignItems: "center", justifyContent: "center",
      color: "var(--muted-foreground)", fontSize: 13,
    }}>
      Sin datos
    </div>
  );
}

/* ── Shared styles ── */

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

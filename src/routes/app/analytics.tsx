import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, CartesianGrid, AreaChart, Area,
} from "recharts";
import { TrendingUp, CheckCircle2, Clock, Kanban } from "lucide-react";

export const Route = createFileRoute("/app/analytics")({
  component: AnalyticsPage,
});

type Request = {
  id: string; priority: string; status_column_id: string | null; created_at: string; updated_at: string;
};
type Column = { id: string; name: string; color: string; is_completed: boolean };

const PRIORITY_COLORS: Record<string, string> = {
  urgent: "#EF4444", high: "#F97316", medium: "#EAB308", low: "#6366F1",
};

function AnalyticsPage() {
  const { areaId, isSuperAdmin } = useAuth();
  const [columns, setColumns] = useState<Column[]>([]);
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);

  const loadAreas = async () => {
    const { data } = await supabase.from("areas").select("*").order("name");
    setAreas(data || []);
  };

  useEffect(() => {
    let query = supabase.from("requests").select("id, priority, status_column_id, created_at, updated_at").order("created_at");

    // Filter by area
    const effectiveAreaId = isSuperAdmin ? selectedArea : areaId;
    if (effectiveAreaId) {
      query = query.eq("area_id", effectiveAreaId);
    }

    Promise.all([
      supabase.from("kanban_columns").select("*").order("position"),
      query,
    ]).then(([{ data: cols }, { data: reqs }]) => {
      setColumns((cols ?? []) as Column[]);
      setRequests((reqs ?? []) as Request[]);
      setLoading(false);
    });

    if (isSuperAdmin) {
      loadAreas();
    }
  }, [areaId, isSuperAdmin, selectedArea]);

  const completedIds = new Set(columns.filter((c) => c.is_completed).map((c) => c.id));
  const completed  = requests.filter((r) => r.status_column_id && completedIds.has(r.status_column_id)).length;
  const inProgress = requests.filter((r) => r.status_column_id && !completedIds.has(r.status_column_id)).length;
  const pending    = requests.filter((r) => !r.status_column_id).length;
  const completionRate = requests.length > 0 ? Math.round((completed / requests.length) * 100) : 0;

  const byCol = columns.map((c) => ({
    name: c.name.length > 12 ? c.name.slice(0, 12) + "…" : c.name,
    fullName: c.name,
    count: requests.filter((r) => r.status_column_id === c.id).length,
    color: c.color,
  }));

  const priorityData = (["urgent", "high", "medium", "low"] as const).map((p) => ({
    name: p.charAt(0).toUpperCase() + p.slice(1),
    value: requests.filter((r) => r.priority === p).length,
    color: PRIORITY_COLORS[p],
  })).filter((d) => d.value > 0);

  // Activity over last 7 days
  const activityData = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    const dateStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString("es", { weekday: "short" });
    const count = requests.filter((r) => r.created_at.slice(0, 10) === dateStr).length;
    return { name: label, count };
  });

  const kpis = [
    { label: "Total solicitudes", value: requests.length,  icon: Kanban,       color: "text-primary",     bg: "bg-primary/10"      },
    { label: "En progreso",       value: inProgress,       icon: TrendingUp,   color: "text-blue-400",    bg: "bg-blue-400/10"     },
    { label: "Pendientes",        value: pending,          icon: Clock,        color: "text-yellow-400",  bg: "bg-yellow-400/10"   },
    { label: "Completadas",       value: completed,        icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10"  },
  ];

  if (loading) {
    return (
      <div className="p-6 space-y-4 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
          ))}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
          <div className="h-72 animate-pulse rounded-xl bg-muted" />
        </div>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-lg">
        <p className="font-medium">{payload[0]?.payload?.fullName ?? label}</p>
        <p className="text-muted-foreground">{payload[0]?.value} solicitudes</p>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Analítica</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Métricas y estado del roadmap</p>
        </div>
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
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4 border-border/50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-3xl font-bold">{k.value}</p>
              </div>
              <div className={`rounded-lg p-2 ${k.bg}`}>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Completion rate */}
      <Card className="border-border/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-sm font-medium">Tasa de completado</p>
            <p className="text-xs text-muted-foreground">{completed} de {requests.length} solicitudes completadas</p>
          </div>
          <span className="text-2xl font-bold text-emerald-400">{completionRate}%</span>
        </div>
        <div className="h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full rounded-full bg-emerald-400 transition-all duration-700"
            style={{ width: `${completionRate}%` }}
          />
        </div>
      </Card>

      {/* Charts row 1 */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* By status */}
        <Card className="border-border/50 p-4">
          <h3 className="text-sm font-semibold mb-4">Por estado</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byCol} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: "var(--color-muted-foreground)" }} />
                <YAxis allowDecimals={false} fontSize={11} tick={{ fill: "var(--color-muted-foreground)" }} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--color-muted)" }} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {byCol.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* By priority */}
        <Card className="border-border/50 p-4">
          <h3 className="text-sm font-semibold mb-4">Por prioridad</h3>
          {priorityData.length === 0 ? (
            <div className="h-56 flex items-center justify-center text-muted-foreground text-sm">Sin datos</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={priorityData}
                    dataKey="value"
                    nameKey="name"
                    outerRadius={80}
                    innerRadius={40}
                    paddingAngle={2}
                  >
                    {priorityData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    formatter={(v) => <span style={{ fontSize: 11, color: "var(--color-muted-foreground)" }}>{v}</span>}
                  />
                  <Tooltip
                    formatter={(v: any, n: any) => [v, n]}
                    contentStyle={{
                      background: "var(--color-popover)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* Activity */}
      <Card className="border-border/50 p-4">
        <h3 className="text-sm font-semibold mb-4">Actividad — últimos 7 días</h3>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={activityData}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="name" fontSize={11} tick={{ fill: "var(--color-muted-foreground)" }} />
              <YAxis allowDecimals={false} fontSize={11} tick={{ fill: "var(--color-muted-foreground)" }} />
              <Tooltip
                contentStyle={{
                  background: "var(--color-popover)",
                  border: "1px solid var(--color-border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="count"
                stroke="var(--color-primary)"
                strokeWidth={2}
                fill="url(#actGrad)"
                dot={{ fill: "var(--color-primary)", r: 3 }}
                name="Solicitudes"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </div>
  );
}

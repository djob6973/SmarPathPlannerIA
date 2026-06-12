import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { getRequestsData, type RequestRow, type ColumnRow } from "@/lib/requests.functions";
import { getAreas } from "@/lib/data.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Kanban, MessageSquare, TrendingUp, Clock, CheckCircle2, AlertCircle, ArrowRight } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardPage,
});

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "priority-urgent", high: "priority-high",
  medium: "priority-medium", low: "priority-low",
};

function DashboardPage() {
  const { profile, user, areaId, isSuperAdmin } = useAuth();
  const [columns, setColumns] = useState<ColumnRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);

  useEffect(() => {
    const effectiveAreaId = isSuperAdmin ? selectedArea : areaId;
    setLoading(true);
    getRequestsData({ data: { areaId: effectiveAreaId } }).then(({ columns, requests }) => {
      setColumns(columns);
      setRequests(requests);
      setLoading(false);
    });

    if (isSuperAdmin) {
      getAreas().then(({ areas }) => setAreas(areas));
    }
  }, [areaId, isSuperAdmin, selectedArea]);

  const completedIds = new Set(columns.filter((c) => c.is_completed).map((c) => c.id));
  const completed  = requests.filter((r) => r.status_column_id && completedIds.has(r.status_column_id)).length;
  const inProgress = requests.filter((r) => r.status_column_id && !completedIds.has(r.status_column_id)).length;
  const pending    = requests.filter((r) => !r.status_column_id).length;
  const urgent     = requests.filter((r) => r.priority === "urgent").length;
  const recent     = requests.slice(0, 5);

  const firstName = profile?.full_name ?? user?.email?.split("@")[0] ?? "Usuario";

  const kpis = [
    { label: "Total solicitudes", value: requests.length, icon: Kanban,       color: "text-primary",     bg: "bg-primary/10"      },
    { label: "En progreso",       value: inProgress,      icon: TrendingUp,   color: "text-blue-400",    bg: "bg-blue-400/10"     },
    { label: "Pendientes",        value: pending,         icon: Clock,        color: "text-yellow-400",  bg: "bg-yellow-400/10"   },
    { label: "Completadas",       value: completed,       icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-400/10"  },
  ];

  return (
    <div className="p-6 space-y-6 max-w-6xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hola, <span className="capitalize">{firstName}</span> 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Aquí tienes un resumen del estado actual del roadmap.
          </p>
        </div>
        {isSuperAdmin && (
          <Select value={selectedArea || "all"} onValueChange={(v) => setSelectedArea(v === "all" ? null : v)}>
            <SelectTrigger className="w-48">
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
      </div>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {kpis.map((k) => (
          <Card key={k.label} className="p-4 border-border/50">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="mt-1 text-3xl font-bold">
                  {loading ? <span className="inline-block h-8 w-12 animate-pulse rounded bg-muted" /> : k.value}
                </p>
              </div>
              <div className={`rounded-lg p-2 ${k.bg}`}>
                <k.icon className={`h-4 w-4 ${k.color}`} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {urgent > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3">
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
          <p className="text-sm">
            Hay <span className="font-semibold">{urgent} solicitud{urgent > 1 ? "es" : ""} urgente{urgent > 1 ? "s" : ""}</span> pendientes de atención.
          </p>
          <Button asChild variant="destructive" size="sm" className="ml-auto shrink-0 h-7 text-xs">
            <Link to="/app/board">Ver tablero</Link>
          </Button>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="md:col-span-2 border-border/50">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/50">
            <h2 className="text-sm font-semibold">Solicitudes recientes</h2>
            <Button asChild variant="ghost" size="sm" className="h-7 text-xs gap-1">
              <Link to="/app/requests">Ver todas <ArrowRight className="h-3 w-3" /></Link>
            </Button>
          </div>
          <div className="divide-y divide-border/50">
            {loading && Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                <div className="h-4 w-4/5 animate-pulse rounded bg-muted" />
                <div className="h-4 w-16 animate-pulse rounded bg-muted ml-auto" />
              </div>
            ))}
            {!loading && recent.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                Sin solicitudes aún. <Link to="/app/chat" className="text-primary hover:underline">Crea una con el Chat IA</Link>.
              </div>
            )}
            {!loading && recent.map((r) => {
              const col = columns.find((c) => c.id === r.status_column_id);
              return (
                <div key={r.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{r.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {col && (
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                        {col.name}
                      </span>
                    )}
                    <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_CLASS[r.priority]}`}>
                      {r.priority}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        <div className="space-y-3">
          <h2 className="text-sm font-semibold px-1">Acciones rápidas</h2>
          {[
            { to: "/app/chat",      icon: MessageSquare, label: "Nueva solicitud con IA",  desc: "El agente te guiará", color: "text-primary" },
            { to: "/app/board",     icon: Kanban,        label: "Abrir tablero Kanban",    desc: "Gestiona por estado", color: "text-blue-400" },
            { to: "/app/analytics", icon: TrendingUp,    label: "Ver analítica",           desc: "Revisa KPIs y gráficos", color: "text-emerald-400" },
          ].map((a) => (
            <Link key={a.to} to={a.to}>
              <Card className="flex items-center gap-3 p-3 border-border/50 hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer">
                <div className={`rounded-lg p-2 bg-muted ${a.color}`}>
                  <a.icon className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{a.label}</p>
                  <p className="text-xs text-muted-foreground">{a.desc}</p>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground ml-auto shrink-0" />
              </Card>
            </Link>
          ))}
        </div>
      </div>

      {!loading && columns.length > 0 && (
        <Card className="border-border/50">
          <div className="px-4 py-3 border-b border-border/50">
            <h2 className="text-sm font-semibold">Distribución por estado</h2>
          </div>
          <div className="px-4 py-4 space-y-3">
            {columns.map((col) => {
              const count = requests.filter((r) => r.status_column_id === col.id).length;
              const pct = requests.length > 0 ? Math.round((count / requests.length) * 100) : 0;
              return (
                <div key={col.id}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-2 text-xs">
                      <span className="h-2 w-2 rounded-full" style={{ background: col.color }} />
                      {col.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${pct}%`, background: col.color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}
    </div>
  );
}

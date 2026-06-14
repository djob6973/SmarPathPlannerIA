import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode, type CSSProperties } from "react";
import { useAuth } from "@/lib/auth-context";
import { getRequestsData, type RequestRow, type ColumnRow } from "@/lib/requests.functions";
import { getAreas } from "@/lib/data.functions";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export const Route = createFileRoute("/app/dashboard")({
  component: DashboardPage,
});

function formatName(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
}

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "priority-urgent",
  high: "priority-high",
  medium: "priority-medium",
  low: "priority-low",
};

const PRIORITY_LABEL: Record<string, string> = {
  urgent: "Urgente",
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

// ─── inline SVG icons (match prototype exactly) ──────────────────────────────

function IconKanban() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="5" height="16" rx="1.3" />
      <rect x="9.5" y="4" width="5" height="11" rx="1.3" />
      <rect x="16" y="4" width="5" height="14" rx="1.3" />
    </svg>
  );
}

function IconClockRun() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12 2.5 2.5 4.5-5" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.3-4.1A7.5 7.5 0 1 1 20 11.5z" />
    </svg>
  );
}

function IconBoard() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="5" height="16" rx="1.4" />
      <rect x="9.5" y="4" width="5" height="11" rx="1.4" />
      <rect x="16" y="4" width="5" height="14" rx="1.4" />
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20h18" />
      <path d="M6 16v-4" />
      <path d="M11 16V7" />
      <path d="M16 16v-6" />
    </svg>
  );
}

function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
    </svg>
  );
}

function IconChevron() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

type KpiCardProps = {
  label: string;
  value: number | null;
  subtitle: string;
  icon: ReactNode;
  iconStyle: CSSProperties;
};

function KpiCard({ label, value, subtitle, icon, iconStyle }: KpiCardProps) {
  return (
    <div className="sp-kcard" style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>{label}</span>
        <span style={{ width: 34, height: 34, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", ...iconStyle }}>
          {icon}
        </span>
      </div>
      <p style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 32, lineHeight: 1.1, marginTop: 14, color: "var(--foreground)", fontVariantNumeric: "tabular-nums" }}>
        {value === null
          ? <span className="inline-block h-8 w-16 animate-pulse rounded-lg bg-muted" />
          : value
        }
      </p>
      <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", opacity: 0.65, marginTop: 6 }}>{subtitle}</p>
    </div>
  );
}

type QuickActionProps = {
  to: string;
  title: string;
  desc: string;
  icon: ReactNode;
  iconStyle: CSSProperties;
};

function QuickAction({ to, title, desc, icon, iconStyle }: QuickActionProps) {
  return (
    <Link to={to} style={{ textDecoration: "none" }}>
      <div className="sp-quick" style={{ display: "flex", alignItems: "center", gap: 13, background: "var(--card)", border: "1px solid var(--border)", borderRadius: 16, padding: 15, cursor: "pointer" }}>
        <span style={{ width: 38, height: 38, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, ...iconStyle }}>
          {icon}
        </span>
        <span style={{ minWidth: 0 }}>
          <span style={{ display: "block", fontSize: 13.5, fontWeight: 600, color: "var(--foreground)" }}>{title}</span>
          <span style={{ display: "block", fontSize: 11.5, color: "var(--muted-foreground)", marginTop: 2 }}>{desc}</span>
        </span>
      </div>
    </Link>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

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

  const displayName = formatName(profile?.full_name) || formatName(user?.email?.split("@")[0]) || "Usuario";
  const firstName = displayName.split(" ")[0];
  const selectedAreaName = selectedArea ? areas.find((a) => a.id === selectedArea)?.name : null;

  const urgentPhrase = urgent > 0
    ? `${urgent} solicitud${urgent > 1 ? "es urgentes" : " urgente"}`
    : "todo al día";

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 40px 64px", animation: "spIn 240ms ease" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, color: "var(--foreground)", letterSpacing: "-0.015em", margin: 0 }}>
            Hola, <span style={{ textTransform: "capitalize" }}>{firstName}</span>
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--muted-foreground)", marginTop: 6 }}>
            Este es el estado de tu roadmap hoy. Tienes{" "}
            <span style={{ color: "var(--primary)", fontWeight: 600 }}>{urgentPhrase}</span>{" "}
            por revisar.
          </p>
        </div>

        {isSuperAdmin && (
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
      </div>

      {/* ── KPI grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
        <KpiCard
          label="Total solicitudes"
          value={loading ? null : requests.length}
          subtitle="en todas las áreas"
          icon={<IconKanban />}
          iconStyle={{ background: "oklch(0.94 0.022 24)", color: "var(--primary)" }}
        />
        <KpiCard
          label="En progreso"
          value={loading ? null : inProgress}
          subtitle="en curso o revisión"
          icon={<IconClockRun />}
          iconStyle={{ background: "var(--muted)", color: "var(--foreground)" }}
        />
        <KpiCard
          label="Pendientes"
          value={loading ? null : pending}
          subtitle="por planear o sin estado"
          icon={<IconClock />}
          iconStyle={{ background: "var(--muted)", color: "var(--foreground)" }}
        />
        <KpiCard
          label="Completadas"
          value={loading ? null : completed}
          subtitle="cerradas este periodo"
          icon={<IconCheck />}
          iconStyle={{ background: "#EEF8D6", color: "#7AAE1B" }}
        />
      </div>

      {/* ── 2-col layout ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16, marginBottom: 16 }}>

        {/* Recent requests */}
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid var(--border)" }}>
            <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 16, color: "var(--foreground)", margin: 0 }}>
              Solicitudes recientes
            </h2>
            <Link
              to="/app/requests"
              style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--primary)", fontSize: 13, fontWeight: 600, textDecoration: "none", padding: "4px 8px", borderRadius: 8 }}
            >
              Ver todas <IconArrow />
            </Link>
          </div>

          <div>
            {loading && Array.from({ length: 5 }).map((_, i) => (
              <div key={i} style={{ padding: "14px 20px", borderBottom: "1px solid var(--border)" }}>
                <div className="h-4 w-3/5 animate-pulse rounded-md bg-muted" />
                <div className="h-3 w-1/4 animate-pulse rounded-md bg-muted mt-2" />
              </div>
            ))}

            {!loading && recent.length === 0 && (
              <div style={{ padding: "32px 20px", textAlign: "center", color: "var(--muted-foreground)", fontSize: 14 }}>
                Sin solicitudes aún.{" "}
                <Link to="/app/chat" style={{ color: "var(--primary)", textDecoration: "none" }}>Crea una con el Chat IA</Link>.
              </div>
            )}

            {!loading && recent.map((r) => {
              const col = columns.find((c) => c.id === r.status_column_id);
              return (
                <div
                  key={r.id}
                  className="sp-row"
                  style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", borderBottom: "1px solid var(--border)", cursor: "pointer" }}
                >
                  <div style={{ flex: "1 1 auto", minWidth: 0 }}>
                    <p style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", margin: 0 }}>
                      {r.title}
                    </p>
                    <p style={{ fontSize: 11.5, color: "var(--muted-foreground)", opacity: 0.7, marginTop: 3, margin: 0 }}>
                      actualizado {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                  {col && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted-foreground)", flexShrink: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: col.color }} />
                      {col.name}
                    </span>
                  )}
                  <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_CLASS[r.priority]}`}>
                    {PRIORITY_LABEL[r.priority] ?? r.priority}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)", padding: "0 2px", margin: 0 }}>
            Acciones rápidas
          </p>
          <QuickAction
            to="/app/chat"
            title="Nueva solicitud con IA"
            desc="El agente te guía paso a paso"
            icon={<IconChat />}
            iconStyle={{ background: "oklch(0.94 0.022 24)", color: "var(--primary)" }}
          />
          <QuickAction
            to="/app/board"
            title="Abrir el tablero"
            desc="Gestiona por estado"
            icon={<IconBoard />}
            iconStyle={{ background: "var(--muted)", color: "var(--foreground)" }}
          />
          <QuickAction
            to="/app/analytics"
            title="Ver analítica"
            desc="KPIs y tendencias"
            icon={<IconAnalytics />}
            iconStyle={{ background: "var(--muted)", color: "var(--foreground)" }}
          />
        </div>
      </div>

      {/* ── Distribution ── */}
      {!loading && columns.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "20px 22px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 16, color: "var(--foreground)", marginBottom: 18, marginTop: 0 }}>
            Distribución por estado
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {columns.map((col) => {
              const count = requests.filter((r) => r.status_column_id === col.id).length;
              const pct = requests.length > 0 ? Math.round((count / requests.length) * 100) : 0;
              return (
                <div key={col.id}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: col.color }} />
                      {col.name}
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>{count} · {pct}%</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, width: `${pct}%`, background: col.color, transition: "width 500ms ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

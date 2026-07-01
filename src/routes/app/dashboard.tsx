import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo, useRef, type ReactNode, type CSSProperties } from "react";
import { SlidersHorizontal } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { useAuth } from "@/lib/auth-context";
import { getRequestsData, type RequestRow, type ColumnRow } from "@/lib/requests.functions";
import { getAreas, listProfiles } from "@/lib/data.functions";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";
import { es, enUS, ptBR } from "date-fns/locale";

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

const PRIORITY_LABEL_KEYS: Record<string, string> = {
  urgent: "priority.urgent",
  high: "priority.high",
  medium: "priority.medium",
  low: "priority.low",
};

const TYPE_ORDER = ["bug", "task", "feature"] as const;
const TYPE_COLORS: Record<string, string> = {
  bug: "#ED5650",
  task: "#9CA3AF",
  feature: "#FFFFFF",
};

const DIFFICULTY_ORDER = ["very_low", "low", "medium", "high", "very_high"] as const;
const DIFFICULTY_COLORS: Record<string, string> = {
  very_low: "#22C55E",
  low: "#84CC16",
  medium: "#EAB308",
  high: "#F97316",
  very_high: "#EF4444",
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
  const { profile, areaId, isSuperAdmin, hasPermission } = useAuth();
  const { t, lang } = useLang();
  const dateLocale = lang === "en" ? enUS : lang === "pt" ? ptBR : es;

  if (!hasPermission("view_dashboard")) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 10 }}>
        <p style={{ fontSize: 15, fontWeight: 600, color: "var(--foreground)", margin: 0 }}>{t("common.noAccess")}</p>
        <p style={{ fontSize: 13, color: "var(--muted-foreground)", margin: 0 }}>{t("dashboard.noPermission")}</p>
      </div>
    );
  }
  const [columns, setColumns] = useState<ColumnRow[]>([]);
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [areas, setAreas] = useState<any[]>([]);
  const [filterAssignedTo, setFilterAssignedTo]   = useState("all");
  const [filterPriority, setFilterPriority]       = useState("all");
  const [filterStatus, setFilterStatus]           = useState("all");
  const [filterCreatedFrom, setFilterCreatedFrom] = useState("");
  const [filterCreatedTo, setFilterCreatedTo]     = useState("");
  const [filterCompletedFrom, setFilterCompletedFrom] = useState("");
  const [filterCompletedTo, setFilterCompletedTo]     = useState("");
  const [filterOpen, setFilterOpen]               = useState(false);
  const [profiles, setProfiles] = useState<{ id: string; full_name: string | null }[]>([]);
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
    listProfiles().then(({ profiles: p }) => setProfiles(p));
  }, [areaId, isSuperAdmin, selectedArea]);

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

  const completedIds = new Set(columns.filter((c) => c.is_completed).map((c) => c.id));
  const completed  = filteredRequests.filter((r) => r.status_column_id && completedIds.has(r.status_column_id)).length;
  const inProgress = filteredRequests.filter((r) => r.status_column_id && !completedIds.has(r.status_column_id)).length;
  const pending    = filteredRequests.filter((r) => !r.status_column_id).length;
  const urgent     = filteredRequests.filter((r) => r.priority === "urgent").length;
  const recent     = filteredRequests.slice(0, 5);

  const displayName = formatName(profile?.full_name) || formatName(profile?.email?.split("@")[0]) || "Usuario";
  const firstName = displayName.split(" ")[0];
  const selectedAreaName = selectedArea ? areas.find((a) => a.id === selectedArea)?.name : null;

  const urgentPhrase = urgent > 0
    ? `${urgent} ${urgent > 1 ? t("dashboard.urgentPlural") : t("dashboard.urgentSingular")}`
    : t("dashboard.upToDate");

  return (
    <div style={{ maxWidth: 1180, margin: "0 auto", padding: "36px 40px 64px", animation: "spIn 240ms ease" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, marginBottom: 28 }}>
        <div>
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 30, color: "var(--foreground)", letterSpacing: "-0.015em", margin: 0 }}>
            {t("dashboard.greeting")}, <span style={{ textTransform: "capitalize" }}>{firstName}</span>
          </h1>
          <p style={{ fontSize: 14.5, color: "var(--muted-foreground)", marginTop: 6 }}>
            {t("dashboard.statusPrefix")}{" "}
            <span style={{ color: "var(--primary)", fontWeight: 600 }}>{urgentPhrase}</span>{" "}
            {t("dashboard.statusSuffix")}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {isSuperAdmin && areas.length > 0 && (
            <select
              value={selectedArea ?? "all"}
              onChange={(e) => setSelectedArea(e.target.value === "all" ? null : e.target.value)}
              style={{
                height: 40, padding: "0 14px",
                borderRadius: "var(--r-xl, 16px)",
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--foreground)",
                fontSize: 13, cursor: "pointer", outline: "none",
              }}
            >
              <option value="all">{t("common.allAreas")}</option>
              {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 12 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".08em", color: "var(--muted-foreground)", marginBottom: 6 }}>{t("requests.priority")}</label>
                    <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)} style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: "var(--r-sm, 10px)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 13, cursor: "pointer", outline: "none" }}>
                      <option value="all">{t("requests.allPriorities")}</option>
                      {["urgent","high","medium","low"].map((p) => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".08em", color: "var(--muted-foreground)", marginBottom: 6 }}>{t("requests.status")}</label>
                    <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: "var(--r-sm, 10px)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 13, cursor: "pointer", outline: "none" }}>
                      <option value="all">{t("requests.allStatuses")}</option>
                      {columns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".08em", color: "var(--muted-foreground)", marginBottom: 6 }}>{t("requests.assignedTo")}</label>
                  <select value={filterAssignedTo} onChange={(e) => setFilterAssignedTo(e.target.value)} style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: "var(--r-sm, 10px)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 13, cursor: "pointer", outline: "none" }}>
                    <option value="all">{t("requests.allAssigned")}</option>
                    {profiles.map((p) => <option key={p.id} value={p.id}>{p.full_name ?? t("common.noName")}</option>)}
                  </select>
                </div>

                <div style={{ height: 1, background: "var(--border)", margin: "0 0 16px" }} />

                <div style={{ marginBottom: 12 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".08em", color: "var(--muted-foreground)", marginBottom: 6 }}>{t("requests.creationDate")}</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{t("common.from")}</span>
                      <input type="date" value={filterCreatedFrom} onChange={(e) => setFilterCreatedFrom(e.target.value)} style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: "var(--r-sm, 10px)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 13, outline: "none" }} />
                    </div>
                    <div>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{t("common.to")}</span>
                      <input type="date" value={filterCreatedTo} onChange={(e) => setFilterCreatedTo(e.target.value)} style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: "var(--r-sm, 10px)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 13, outline: "none" }} />
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".08em", color: "var(--muted-foreground)", marginBottom: 6 }}>{t("requests.completedDate")}</label>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{t("common.from")}</span>
                      <input type="date" value={filterCompletedFrom} onChange={(e) => setFilterCompletedFrom(e.target.value)} style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: "var(--r-sm, 10px)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 13, outline: "none" }} />
                    </div>
                    <div>
                      <span style={{ display: "block", fontSize: 11, color: "var(--muted-foreground)", marginBottom: 4 }}>{t("common.to")}</span>
                      <input type="date" value={filterCompletedTo} onChange={(e) => setFilterCompletedTo(e.target.value)} style={{ width: "100%", height: 36, padding: "0 10px", borderRadius: "var(--r-sm, 10px)", border: "1px solid var(--border)", background: "var(--card)", color: "var(--foreground)", fontSize: 13, outline: "none" }} />
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <button
                    onClick={clearAllFilters}
                    disabled={activeFilterCount === 0}
                    style={{ background: "transparent", border: "none", padding: "4px 0", color: activeFilterCount === 0 ? "var(--muted-foreground)" : "#ef4444", fontSize: 13, cursor: activeFilterCount === 0 ? "default" : "pointer", opacity: activeFilterCount === 0 ? 0.45 : 1 }}
                  >
                    {t("common.clearAll")}
                  </button>
                  <button
                    onClick={() => setFilterOpen(false)}
                    style={{ background: "var(--primary)", color: "var(--primary-foreground)", border: "none", borderRadius: "var(--r-sm, 10px)", padding: "7px 20px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
                  >
                    {t("common.apply")}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── KPI grid ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 16 }}>
        <KpiCard
          label={t("dashboard.kpiTotal")}
          value={loading ? null : filteredRequests.length}
          subtitle={t("dashboard.kpiTotalSub")}
          icon={<IconKanban />}
          iconStyle={{ background: "oklch(0.94 0.022 24)", color: "var(--primary)" }}
        />
        <KpiCard
          label={t("dashboard.kpiInProgress")}
          value={loading ? null : inProgress}
          subtitle={t("dashboard.kpiInProgressSub")}
          icon={<IconClockRun />}
          iconStyle={{ background: "var(--muted)", color: "var(--foreground)" }}
        />
        <KpiCard
          label={t("dashboard.kpiPending")}
          value={loading ? null : pending}
          subtitle={t("dashboard.kpiPendingSub")}
          icon={<IconClock />}
          iconStyle={{ background: "var(--muted)", color: "var(--foreground)" }}
        />
        <KpiCard
          label={t("dashboard.kpiCompleted")}
          value={loading ? null : completed}
          subtitle={t("dashboard.kpiCompletedSub")}
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
              {t("dashboard.recentTitle")}
            </h2>
            <Link
              to="/app/requests"
              style={{ display: "flex", alignItems: "center", gap: 5, color: "var(--primary)", fontSize: 13, fontWeight: 600, textDecoration: "none", padding: "4px 8px", borderRadius: 8 }}
            >
              {t("dashboard.seeAll")} <IconArrow />
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
                {t("dashboard.noRequests")}{" "}
                <Link to="/app/chat" style={{ color: "var(--primary)", textDecoration: "none" }}>{t("dashboard.createWithAI")}</Link>.
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
                      {t("dashboard.updatedAt")} {formatDistanceToNow(new Date(r.updated_at), { addSuffix: true, locale: dateLocale })}
                    </p>
                  </div>
                  {col && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--muted-foreground)", flexShrink: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: col.color }} />
                      {col.name}
                    </span>
                  )}
                  <Badge className={`text-[10px] px-1.5 py-0 ${PRIORITY_CLASS[r.priority]}`}>
                    {t(PRIORITY_LABEL_KEYS[r.priority] ?? r.priority)}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>

        {/* Quick actions */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: "var(--muted-foreground)", padding: "0 2px", margin: 0 }}>
            {t("dashboard.quickActions")}
          </p>
          <QuickAction
            to="/app/chat"
            title={t("dashboard.qaNewRequest")}
            desc={t("dashboard.qaNewRequestDesc")}
            icon={<IconChat />}
            iconStyle={{ background: "oklch(0.94 0.022 24)", color: "var(--primary)" }}
          />
          <QuickAction
            to="/app/board"
            title={t("dashboard.qaBoard")}
            desc={t("dashboard.qaBoardDesc")}
            icon={<IconBoard />}
            iconStyle={{ background: "var(--muted)", color: "var(--foreground)" }}
          />
          <QuickAction
            to="/app/analytics"
            title={t("dashboard.qaAnalytics")}
            desc={t("dashboard.qaAnalyticsDesc")}
            icon={<IconAnalytics />}
            iconStyle={{ background: "var(--muted)", color: "var(--foreground)" }}
          />
        </div>
      </div>

      {/* ── Distribution ── */}
      {!loading && columns.length > 0 && filteredRequests.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "20px 22px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 16, color: "var(--foreground)", marginBottom: 18, marginTop: 0 }}>
            {t("dashboard.distribution")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {columns.map((col) => {
              const count = filteredRequests.filter((r) => r.status_column_id === col.id).length;
              const pct = filteredRequests.length > 0 ? Math.round((count / filteredRequests.length) * 100) : 0;
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

      {/* ── Distribution by type ── */}
      {!loading && filteredRequests.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "20px 22px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 16, color: "var(--foreground)", marginBottom: 18, marginTop: 0 }}>
            {t("dashboard.distributionByType")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {TYPE_ORDER.map((key) => {
              const color = TYPE_COLORS[key];
              const border = key === "feature" ? "1px solid var(--border)" : "none";
              const count = filteredRequests.filter((r) => r.type === key).length;
              const pct = filteredRequests.length > 0 ? Math.round((count / filteredRequests.length) * 100) : 0;
              return (
                <div key={key}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: color, border, boxSizing: "border-box" }} />
                      {t(`type.${key}` as any)}
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>{count} · {pct}%</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, width: `${pct}%`, background: color, border, boxSizing: "border-box", transition: "width 500ms ease" }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Distribution by difficulty ── */}
      {!loading && filteredRequests.length > 0 && (
        <div style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 20, padding: "20px 22px" }}>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 16, color: "var(--foreground)", marginBottom: 18, marginTop: 0 }}>
            {t("dashboard.distributionByDifficulty")}
          </h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {DIFFICULTY_ORDER.map((key) => {
              const color = DIFFICULTY_COLORS[key];
              const count = filteredRequests.filter((r) => r.difficulty === key).length;
              const pct = filteredRequests.length > 0 ? Math.round((count / filteredRequests.length) * 100) : 0;
              return (
                <div key={key}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 7 }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--foreground)" }}>
                      <span style={{ width: 9, height: 9, borderRadius: 999, background: color }} />
                      {t(`difficulty.${key}` as any)}
                    </span>
                    <span style={{ fontSize: 12.5, color: "var(--muted-foreground)" }}>{count} · {pct}%</span>
                  </div>
                  <div style={{ height: 7, borderRadius: 999, background: "var(--muted)", overflow: "hidden" }}>
                    <div style={{ height: "100%", borderRadius: 999, width: `${pct}%`, background: color, transition: "width 500ms ease" }} />
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

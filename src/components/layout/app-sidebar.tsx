import { Link, useRouterState } from "@tanstack/react-router";
import type { CSSProperties } from "react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPlatformSetting } from "@/lib/settings.functions";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ─── SVG icons (match prototype stroke-width="1.6") ──────────────────────────

function IconDashboard() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="9" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="12" width="7" height="9" rx="1.5" />
      <rect x="3" y="16" width="7" height="5" rx="1.5" />
    </svg>
  );
}

function IconBoard() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="5" height="16" rx="1.4" />
      <rect x="9.5" y="4" width="5" height="11" rx="1.4" />
      <rect x="16" y="4" width="5" height="14" rx="1.4" />
    </svg>
  );
}

function IconRequests() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h12" /><path d="M8 12h12" /><path d="M8 18h12" />
      <path d="M3.5 6h.01" /><path d="M3.5 12h.01" /><path d="M3.5 18h.01" />
    </svg>
  );
}

function IconChat() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 11.5a7.5 7.5 0 0 1-10.9 6.7L4 19.5l1.3-4.1A7.5 7.5 0 1 1 20 11.5z" />
      <path d="m12.5 7.5.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
    </svg>
  );
}

function IconAnalytics() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 20h18" /><path d="M6 16v-4" /><path d="M11 16V7" /><path d="M16 16v-6" />
    </svg>
  );
}

function IconTeam() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8" r="3" />
      <path d="M4 19c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      <path d="M16 6.2A3 3 0 0 1 17 12" />
      <path d="M15.5 14.2c2 .5 3.5 2.3 3.5 4.8" />
    </svg>
  );
}

function IconSettings() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.1a2 2 0 0 1-4 0v-.1a1.7 1.7 0 0 0-2.9-1.2l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a2 2 0 0 1 0-4h.1A1.7 1.7 0 0 0 5.3 7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3 1.7 1.7 0 0 0 1-1.5V3a2 2 0 0 1 4 0v.1a1.7 1.7 0 0 0 2.9 1.2l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.5 1H21a2 2 0 0 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </svg>
  );
}

function IconSearch() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.2-3.2" />
    </svg>
  );
}

function IconBell() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15z" />
      <path d="M10 19a2 2 0 0 0 4 0" />
    </svg>
  );
}

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2m-7.1-14.1 1.4 1.4m12.4 12.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4m12.4-12.4 1.4-1.4" />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}

function IconMonitor() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" />
      <path d="M8 21h8M12 17v4" />
    </svg>
  );
}

function IconLogOut() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <polyline points="16 17 21 12 16 7" />
      <line x1="21" y1="12" x2="9" y2="12" />
    </svg>
  );
}

function IconChevronRight() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

// ─── Logo mark ───────────────────────────────────────────────────────────────

function DataicoMark({ size = 24 }: { size?: number }) {
  // viewBox 94×72 — two rounded chevrons ">>"
  const w = Math.round(size * (94 / 72));
  return (
    <svg viewBox="0 0 94 72" width={w} height={size} fill="currentColor">
      {/* Left chevron – top piece */}
      <path d="M3 36C3 17 16 3 33 3c5 0 9 2 12 6C37 11 28 22 25 36H3z"/>
      {/* Left chevron – bottom piece */}
      <path d="M3 36C3 55 16 69 33 69c5 0 9-2 12-6C37 61 28 50 25 36H3z"/>
      {/* Right chevron – top piece */}
      <path d="M50 36C50 17 63 3 80 3c5 0 9 2 12 6C84 11 75 22 72 36H50z"/>
      {/* Right chevron – bottom piece */}
      <path d="M50 36C50 55 63 69 80 69c5 0 9-2 12-6C84 61 75 50 72 36H50z"/>
    </svg>
  );
}

// ─── Nav item data ────────────────────────────────────────────────────────────

import type { AppPermission } from "@/lib/permissions.types";

const NAV_ITEMS: { to: string; icon: React.ComponentType; label: string; permission?: AppPermission }[] = [
  { to: "/app/dashboard", icon: IconDashboard, label: "Dashboard",   permission: "view_dashboard" },
  { to: "/app/board",     icon: IconBoard,     label: "Tablero",     permission: "view_board"      },
  { to: "/app/requests",  icon: IconRequests,  label: "Solicitudes" },
  { to: "/app/chat",      icon: IconChat,      label: "Chat IA"     },
  { to: "/app/analytics", icon: IconAnalytics, label: "Analítica",   permission: "view_analytics" },
  { to: "/app/team",      icon: IconTeam,      label: "Equipo",      permission: "view_team"      },
];

// ─── Props ────────────────────────────────────────────────────────────────────

interface AppSidebarProps {
  unreadCount?: number;
  onNotificationsClick?: () => void;
  onSearchClick?: () => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function AppSidebar({ unreadCount = 0, onNotificationsClick, onSearchClick }: AppSidebarProps) {
  const { user, roles, hasRole, hasPermission, signOut, profile, isSuperAdmin } = useAuth();

  const { data: logoData } = useQuery({
    queryKey: ["platform-setting", "logo_url"],
    queryFn:  () => getPlatformSetting({ data: { key: "logo_url" } }),
    staleTime: 10 * 60 * 1000,
  });
  const customLogo = logoData?.value ?? null;
  const { theme, setTheme, resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  function formatName(raw: string | null | undefined): string {
    if (!raw) return "";
    return raw.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  }

  const displayName = formatName(profile?.full_name) || formatName(user?.email?.split("@")[0]) || "Usuario";
  const initials    = displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "SP";
  const roleLabel   = roles[0]?.replace(/_/g, " ") ?? "—";

  const isDark = resolvedTheme === "dark";

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const ThemeIcon = theme === "dark" ? IconMoon : theme === "light" ? IconSun : IconMonitor;
  const themeLabel = theme === "dark" ? "Oscuro" : theme === "light" ? "Claro" : "Sistema";

  // ── CSS variable tokens (mirror prototype --sb- vars via inline style on root)
  const sbVars = isDark
    ? {
        "--sb-bg":        "#333333",
        "--sb-text":      "rgba(255,255,255,.88)",
        "--sb-text-muted":"rgba(255,255,255,.50)",
        "--sb-hover-bg":  "rgba(255,255,255,.07)",
        "--sb-active-bg": "#ED5650",
        "--sb-shadow":    "0 8px 24px rgba(0,0,0,.18)",
      }
    : {
        "--sb-bg":        "#ffffff",
        "--sb-text":      "#333333",
        "--sb-text-muted":"rgba(51,51,51,.50)",
        "--sb-hover-bg":  "#F1F1F1",
        "--sb-active-bg": "#ED5650",
        "--sb-shadow":    "0 8px 24px rgba(0,0,0,.06)",
      };

  return (
    <aside
      style={{
        ...sbVars as CSSProperties,
        width: 240,
        flexShrink: 0,
        display: "flex",
        flexDirection: "column",
        margin: "16px 0 16px 16px",
        padding: "20px 12px 16px",
        background: "var(--sb-bg)",
        color: "var(--sb-text)",
        borderRadius: 20,
        boxShadow: "var(--sb-shadow)",
        height: "calc(100vh - 32px)",
        position: "sticky",
        top: 16,
        userSelect: "none",
      } as CSSProperties}
      aria-label="Navegación principal"
    >
      {/* ── Logo ── */}
      <div style={{ display: "flex", alignItems: "center", gap: 11, paddingLeft: 8, marginBottom: 24 }}>
        <span style={{ color: "#ED5650", display: "flex", flexShrink: 0 }}>
          {customLogo
            ? <img src={customLogo} alt="Logo" style={{ height: 30, width: "auto", maxWidth: 36, objectFit: "contain" }} />
            : <DataicoMark size={30} />
          }
        </span>
        <div style={{ display: "flex", flexDirection: "column", lineHeight: 1 }}>
          <span style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 17, color: "var(--sb-text)", letterSpacing: "-0.01em" }}>
            SmartPath
          </span>
          <span style={{ fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--sb-text-muted)", marginTop: 4, fontWeight: 500 }}>
            Planner IA
          </span>
        </div>
      </div>

      {/* ── Navigation ── */}
      <nav style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {NAV_ITEMS.filter(({ permission }) => !permission || hasPermission(permission)).map(({ to, icon: Icon, label }) => {
          const isActive = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px",
                borderRadius: 10, textDecoration: "none",
                fontSize: 14, fontWeight: isActive ? 500 : 400,
                color: isActive ? "#fff" : "var(--sb-text)",
                background: isActive ? "var(--sb-active-bg)" : "transparent",
                transition: "background 120ms ease, color 120ms ease",
              }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "var(--sb-hover-bg)"; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ display: "inline-flex", width: 20, height: 20, alignItems: "center", justifyContent: "center", flexShrink: 0, color: isActive ? "#fff" : "var(--sb-text-muted)" }}>
                <Icon />
              </span>
              {label}
            </Link>
          );
        })}

        {isSuperAdmin ? (
          <>
            <p style={{ padding: "0 12px", margin: "16px 0 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--sb-text-muted)" }}>
              Administración
            </p>
            <Link
              to="/app/settings"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px",
                borderRadius: 10, textDecoration: "none",
                fontSize: 14, fontWeight: pathname.startsWith("/app/settings") ? 500 : 400,
                color: pathname.startsWith("/app/settings") ? "#fff" : "var(--sb-text)",
                background: pathname.startsWith("/app/settings") ? "var(--sb-active-bg)" : "transparent",
                transition: "background 120ms ease, color 120ms ease",
              }}
              onMouseEnter={(e) => { if (!pathname.startsWith("/app/settings")) (e.currentTarget as HTMLElement).style.background = "var(--sb-hover-bg)"; }}
              onMouseLeave={(e) => { if (!pathname.startsWith("/app/settings")) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ display: "inline-flex", width: 20, height: 20, alignItems: "center", justifyContent: "center", flexShrink: 0, color: pathname.startsWith("/app/settings") ? "#fff" : "var(--sb-text-muted)" }}>
                <IconSettings />
              </span>
              Configuración
            </Link>
          </>
        ) : (
          <>
            <p style={{ padding: "0 12px", margin: "16px 0 6px", fontSize: 10, fontWeight: 600, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--sb-text-muted)" }}>
              Cuenta
            </p>
            <Link
              to="/app/settings"
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 12px",
                borderRadius: 10, textDecoration: "none",
                fontSize: 14, fontWeight: pathname.startsWith("/app/settings") ? 500 : 400,
                color: pathname.startsWith("/app/settings") ? "#fff" : "var(--sb-text)",
                background: pathname.startsWith("/app/settings") ? "var(--sb-active-bg)" : "transparent",
                transition: "background 120ms ease, color 120ms ease",
              }}
              onMouseEnter={(e) => { if (!pathname.startsWith("/app/settings")) (e.currentTarget as HTMLElement).style.background = "var(--sb-hover-bg)"; }}
              onMouseLeave={(e) => { if (!pathname.startsWith("/app/settings")) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ display: "inline-flex", width: 20, height: 20, alignItems: "center", justifyContent: "center", flexShrink: 0, color: pathname.startsWith("/app/settings") ? "#fff" : "var(--sb-text-muted)" }}>
                <IconSettings />
              </span>
              Mi Perfil
            </Link>
          </>
        )}
      </nav>

      {/* ── Spacer ── */}
      <div style={{ flex: 1 }} />

      {/* ── Footer ── */}
      <div style={{ display: "flex", flexDirection: "column", gap: 12, paddingTop: 12 }}>

        {/* Utility buttons row */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-around", gap: 4, padding: 4 }}>
          {/* Notifications */}
          <button
            onClick={onNotificationsClick}
            aria-label="Notificaciones"
            style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, border: 0, background: "transparent", borderRadius: 999, color: "var(--sb-text-muted)", cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--sb-hover-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--sb-text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--sb-text-muted)"; }}
          >
            <IconBell />
            {unreadCount > 0 && (
              <span style={{ position: "absolute", top: 4, right: 5, width: 8, height: 8, background: "#ED5650", border: `1.5px solid var(--sb-bg)`, borderRadius: 999 }} />
            )}
          </button>

          {/* Search */}
          <button
            onClick={onSearchClick}
            aria-label="Buscar (⌘K)"
            title="Buscar (⌘K)"
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, border: 0, background: "transparent", borderRadius: 999, color: "var(--sb-text-muted)", cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--sb-hover-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--sb-text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--sb-text-muted)"; }}
          >
            <IconSearch />
          </button>

          {/* Theme toggle */}
          <button
            onClick={() => setTheme(nextTheme)}
            aria-label={`Tema: ${themeLabel}`}
            title={`Tema: ${themeLabel}`}
            style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, border: 0, background: "transparent", borderRadius: 999, color: "var(--sb-text-muted)", cursor: "pointer" }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--sb-hover-bg)"; (e.currentTarget as HTMLElement).style.color = "var(--sb-text)"; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "var(--sb-text-muted)"; }}
          >
            <ThemeIcon />
          </button>
        </div>

        {/* User row */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 8px", borderRadius: 10, border: 0, background: "transparent", cursor: "pointer", width: "100%", textAlign: "left", color: "var(--sb-text)" }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = "var(--sb-hover-bg)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}
            >
              <span style={{ width: 36, height: 36, borderRadius: 999, background: "#ED5650", color: "#fff", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 14 }}>
                {initials}
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: "block", fontSize: 13, fontWeight: 500, color: "var(--sb-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {displayName}
                </span>
                <span style={{ display: "block", fontSize: 11, color: "var(--sb-text-muted)", textTransform: "capitalize", marginTop: 1 }}>
                  {roleLabel}
                </span>
              </span>
              <span style={{ color: "var(--sb-text-muted)", flexShrink: 0 }}>
                <IconChevronRight />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52 mb-1">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground capitalize">{roles.join(", ") || "sin rol"}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <span style={{ marginRight: 8 }}><IconLogOut /></span>
              Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard, Kanban, ListTodo, MessageSquare,
  BarChart3, Users, Settings, ChevronDown,
  LogOut, Moon, Sun, Monitor, Zap,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useTheme } from "@/lib/theme-context";
import { useNavigate } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const NAV_ITEMS = [
  { to: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/app/board",     icon: Kanban,          label: "Tablero"   },
  { to: "/app/requests",  icon: ListTodo,         label: "Solicitudes"},
  { to: "/app/chat",      icon: MessageSquare,    label: "Chat IA"   },
  { to: "/app/analytics", icon: BarChart3,        label: "Analítica" },
  { to: "/app/team",      icon: Users,            label: "Equipo"    },
];

interface AppSidebarProps {
  unreadCount?: number;
  onNotificationsClick?: () => void;
  onSearchClick?: () => void;
}

export function AppSidebar({ unreadCount = 0, onNotificationsClick, onSearchClick }: AppSidebarProps) {
  const { user, roles, hasRole, signOut, profile } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const navigate = useNavigate();
  const routerState = useRouterState();
  const pathname = routerState.location.pathname;

  function formatName(raw: string | null | undefined): string {
    if (!raw) return "";
    return raw.replace(/[._]/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()).trim();
  }

  const displayName = formatName(profile?.full_name) || formatName(user?.email?.split("@")[0]) || "Usuario";
  const initials = displayName.split(" ").map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "SP";

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  const ThemeIcon = theme === "dark" ? Moon : theme === "light" ? Sun : Monitor;
  const nextTheme = theme === "dark" ? "light" : theme === "light" ? "system" : "dark";
  const themeLabel = theme === "dark" ? "Oscuro" : theme === "light" ? "Claro" : "Sistema";

  return (
    <aside className="flex h-screen w-60 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border select-none">
      {/* Logo + Workspace */}
      <div className="flex items-center gap-3 px-4 py-5 border-b border-sidebar-border">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20">
          <Zap className="h-4 w-4 text-sidebar-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate text-sidebar-foreground">SmartPath</p>
          <p className="text-xs text-sidebar-foreground/50 truncate">Planner IA</p>
        </div>
      </div>

      {/* Search shortcut */}
      <div className="px-3 pt-3">
        <button
          onClick={onSearchClick}
          className="flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground/90 transition-colors"
        >
          <span className="flex-1 text-left">Buscar...</span>
          <kbd className="rounded bg-sidebar-border px-1 py-0.5 text-[10px] font-mono">⌘K</kbd>
        </button>
      </div>

      {/* Main navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
        <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 mb-1">
          Principal
        </p>
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => {
          const isActive = pathname.startsWith(to);
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                "sidebar-item",
                isActive && "active"
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </Link>
          );
        })}

        {hasRole("super_admin") && (
          <>
            <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/30 mt-3 mb-1">
              Administración
            </p>
            <Link
              to="/app/settings"
              className={cn("sidebar-item", pathname.startsWith("/app/settings") && "active")}
            >
              <Settings className="h-4 w-4 shrink-0" />
              Configuración
            </Link>
          </>
        )}
      </nav>

      {/* Notifications */}
      <div className="px-3 pb-1">
        <button
          onClick={onNotificationsClick}
          className="sidebar-item w-full opacity-70 hover:opacity-100"
        >
          <div className="relative">
            <div className="h-4 w-4">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
              </svg>
            </div>
            {unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </div>
          <span className="flex-1 text-left">Notificaciones</span>
          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] font-medium text-sidebar-primary">
              {unreadCount}
            </span>
          )}
        </button>
      </div>

      {/* Theme toggle */}
      <div className="px-3 pb-1">
        <button
          onClick={() => setTheme(nextTheme)}
          className="sidebar-item w-full"
        >
          <ThemeIcon className="h-4 w-4 shrink-0" />
          <span className="flex-1 text-left">Tema: {themeLabel}</span>
        </button>
      </div>

      {/* User profile */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-md p-2 text-sm hover:bg-sidebar-accent transition-colors">
              <Avatar className="h-8 w-8 shrink-0">
                <AvatarFallback className="bg-primary/20 text-sidebar-primary text-xs font-semibold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-medium truncate text-sidebar-foreground">
                  {displayName}
                </p>
                <p className="text-[10px] text-sidebar-foreground/50 truncate capitalize">
                  {typeof roles[0] === 'object' && roles[0] !== null && 'role' in roles[0] ? roles[0].role : roles[0] ?? "—"}
                </p>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-sidebar-foreground/50 shrink-0" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="top" align="start" className="w-52 mb-1">
            <div className="px-2 py-1.5">
              <p className="text-xs font-medium truncate">{displayName}</p>
              <p className="text-xs text-muted-foreground capitalize">{roles.join(", ") || "sin rol"}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setTheme("dark")}>
              <Moon className="mr-2 h-3.5 w-3.5" /> Modo oscuro
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setTheme("light")}>
              <Sun className="mr-2 h-3.5 w-3.5" /> Modo claro
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-3.5 w-3.5" /> Cerrar sesión
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </aside>
  );
}

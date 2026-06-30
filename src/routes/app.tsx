import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { SearchDialog } from "@/components/search/search-dialog";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/app")({
  component: AppLayout,
});

function getInitials(name: string | null | undefined, email: string | null | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.slice(0, 2).toUpperCase();
  return "?";
}

function AppLayout() {
  const { isAuthenticated, profile, user } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Global Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleUnreadChange = useCallback((count: number) => setUnreadCount(count), []);

  // Auth is loaded server-side via the root route loader.
  // If we reach here without a user, the SSR headers didn't have X-Forwarded-Email.
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <p className="text-2xl font-semibold mb-2">Sesión no iniciada</p>
          <p className="text-sm text-muted-foreground mb-6">
            Tu sesión ha expirado o no has iniciado sesión.
          </p>
          <a
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Iniciar sesión
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <AppSidebar
        unreadCount={unreadCount}
        onNotificationsClick={() => setNotifOpen(true)}
        onSearchClick={() => setSearchOpen(true)}
      />

      <main className="flex flex-1 flex-col overflow-hidden">
        {/* ── Top header bar ── */}
        <header className="flex h-14 shrink-0 items-center justify-end gap-3 border-b border-border bg-background px-5">
          {/* Search */}
          <button
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-52 items-center gap-2.5 rounded-full border border-border bg-muted/50 px-3.5 text-sm text-muted-foreground transition-colors hover:bg-muted"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <span className="flex-1 text-left text-sm text-muted-foreground">Buscar...</span>
          </button>

          {/* Notification bell */}
          <button
            onClick={() => setNotifOpen(true)}
            aria-label="Notificaciones"
            className="relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
            </svg>
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#ED5650] font-mono text-[9px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {/* User avatar */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1a1a1a] font-semibold text-[13px] text-white select-none">
            {getInitials(profile?.full_name, user?.email)}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </main>

      <NotificationPanel
        open={notifOpen}
        onClose={() => setNotifOpen(false)}
        onUnreadCountChange={handleUnreadChange}
      />

      <SearchDialog
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
      />

      <Toaster richColors position="top-right" />
    </div>
  );
}

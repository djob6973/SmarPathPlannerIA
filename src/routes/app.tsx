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

function AppLayout() {
  const { isAuthenticated } = useAuth();
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
            Haz clic para autenticarte con Google.
          </p>
          <a
            href="/api/auth/signin"
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Iniciar sesión con Google
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

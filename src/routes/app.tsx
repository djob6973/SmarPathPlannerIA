import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
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
  const { loading, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      // Send to oauth2-proxy sign-in to re-authenticate via Google SSO.
      // Using window.location avoids a SPA redirect loop.
      // Reload the current page as a real HTTP request so oauth2-proxy
      // captures the return URL and redirects back here after Google auth.
      window.location.reload();
    }
  }, [loading, isAuthenticated]);

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

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">Cargando...</p>
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
    </div>
  );
}

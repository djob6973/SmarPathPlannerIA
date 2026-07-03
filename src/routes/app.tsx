import { createFileRoute, Outlet } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { NotificationPanel } from "@/components/notifications/notification-panel";
import { SearchDialog } from "@/components/search/search-dialog";
import { Toaster } from "@/components/ui/sonner";
import { getPlatformSetting } from "@/lib/settings.functions";
import { selfAssignClientRole } from "@/lib/auth.functions";

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

function PendingApprovalScreen({ email }: { email: string | null | undefined }) {
  const { refreshRoles } = useAuth();
  const [assigning, setAssigning] = useState(false);

  const { data: logoData } = useQuery({
    queryKey: ["platform-setting", "logo_url"],
    queryFn: () => getPlatformSetting({ data: { key: "logo_url" } }),
    staleTime: 10 * 60 * 1000,
  });
  const logoUrl = logoData?.value ?? null;

  const handleContinueAsClient = async () => {
    setAssigning(true);
    try {
      await selfAssignClientRole();
      await refreshRoles();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo asignar el rol");
      setAssigning(false);
    }
  };

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center px-4 py-12"
      style={{ background: "#1a1a1a", color: "#F1F1F1" }}
    >
      <div className="mb-8 flex flex-col items-center text-center">
        {logoUrl ? (
          <img src={logoUrl} alt="Logo" className="mb-4 h-16 max-w-[140px] object-contain" />
        ) : (
          <div
            className="mb-4 flex size-16 items-center justify-center rounded-2xl"
            style={{ background: "#ED5650" }}
          >
            <DataicoMark size={26} />
          </div>
        )}
        <span className="text-2xl font-bold tracking-tight text-white">SmartPath</span>
        <span className="mt-1 font-mono text-[10px] uppercase tracking-widest text-white/40">
          Planner IA
        </span>
      </div>

      <div
        className="w-full max-w-sm rounded-2xl px-7 py-9 text-center"
        style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div
          className="mx-auto mb-5 flex size-12 items-center justify-center rounded-2xl"
          style={{ background: "rgba(237,86,80,0.15)" }}
        >
          <Clock className="size-5" style={{ color: "#ED5650" }} strokeWidth={1.75} />
        </div>

        <p className="text-lg font-bold text-white">Cuenta pendiente de aprobación</p>
        <p className="mt-3 text-[13px] leading-relaxed text-white/60">
          Un administrador revisará tu acceso y te asignará un rol en breve.
        </p>
        <p className="mt-2 text-[13px] leading-relaxed text-white/60">
          Si deseas, puedes continuar con el rol <span className="font-semibold text-white">Cliente</span>, por favor haz clic en continuar.
        </p>
        <p className="mt-4 text-[12px] text-white/40">
          Sesión iniciada como <span className="font-semibold text-white/70">{email}</span>
        </p>

        <button
          onClick={handleContinueAsClient}
          disabled={assigning}
          className="mt-6 w-full rounded-full py-3 text-[13px] font-semibold text-white shadow-sm transition-colors disabled:opacity-60"
          style={{ background: "#ED5650" }}
        >
          {assigning ? "Asignando..." : "Continuar como Cliente"}
        </button>
      </div>

      <p className="mt-8 text-center font-mono text-[9px] uppercase tracking-widest text-white/30">
        SmartPath Planner · Planificación con IA
      </p>
    </div>
  );
}

function DataicoMark({ size = 24 }: { size?: number }) {
  const w = Math.round(size * (94 / 72));
  return (
    <svg viewBox="0 0 94 72" width={w} height={size} fill="#fff">
      <path d="M3 36C3 17 16 3 33 3c5 0 9 2 12 6C37 11 28 22 25 36H3z" />
      <path d="M3 36C3 55 16 69 33 69c5 0 9-2 12-6C37 61 28 50 25 36H3z" />
      <path d="M50 36C50 17 63 3 80 3c5 0 9 2 12 6C84 11 75 22 72 36H50z" />
      <path d="M50 36C50 55 63 69 80 69c5 0 9-2 12-6C84 61 75 50 72 36H50z" />
    </svg>
  );
}

function AppLayout() {
  const { isAuthenticated, profile, user, roles } = useAuth();
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

  // Auth is loaded server-side via the root route loader from X-Forwarded-Email.
  // Reaching this with no user means the perimeter's SSO header didn't come through
  // (misconfiguration or a stale edge cache) — there's no login page to send them to,
  // since the platform's SSO already gates the whole domain before requests get here.
  if (!isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="max-w-sm text-center">
          <p className="text-2xl font-semibold mb-2">No se pudo verificar tu sesión</p>
          <p className="text-sm text-muted-foreground mb-6">
            Intenta recargar la página. Si el problema persiste, contacta al administrador de la plataforma.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Recargar
          </button>
        </div>
      </div>
    );
  }

  // A Super Admin hasn't assigned this user a role/area yet — everything in the
  // sidebar is permission-gated, so without this screen they'd just see an empty
  // shell with no explanation of why nothing works.
  if (roles.length === 0) {
    return <PendingApprovalScreen email={user?.email} />;
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
        <header className="flex h-14 shrink-0 items-end justify-end gap-3 bg-background px-5 pb-2">
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

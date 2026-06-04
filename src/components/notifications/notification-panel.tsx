import { useEffect, useState, useCallback } from "react";
import { X, Bell, CheckCheck, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export type Notification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  data: Record<string, unknown>;
  read: boolean;
  created_at: string;
};

const TYPE_ICON: Record<string, string> = {
  request_created: "📋",
  request_assigned: "👤",
  status_changed: "🔄",
  comment_added: "💬",
  role_changed: "🔑",
  user_registered: "👋",
};

interface NotificationPanelProps {
  open: boolean;
  onClose: () => void;
  onUnreadCountChange?: (count: number) => void;
}

export function NotificationPanel({ open, onClose, onUnreadCountChange }: NotificationPanelProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const notifs = (data ?? []) as Notification[];
    setNotifications(notifs);
    onUnreadCountChange?.(notifs.filter((n) => !n.read).length);
    setLoading(false);
  }, [user, onUnreadCountChange]);

  useEffect(() => { load(); }, [load]);

  // Supabase Realtime subscription
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => load()
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, load]);

  const markAllRead = async () => {
    if (!user) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    load();
  };

  const markRead = async (id: string) => {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    onUnreadCountChange?.(notifications.filter((n) => !n.read && n.id !== id).length);
  };

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <>
      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <aside
        className={cn(
          "fixed right-0 top-0 z-50 flex h-screen w-80 flex-col bg-card border-l border-border shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-4">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Notificaciones</span>
            {unread > 0 && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-xs font-medium text-primary">
                {unread}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1">
            {unread > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllRead} className="h-7 gap-1 text-xs px-2">
                <CheckCheck className="h-3.5 w-3.5" />
                Todo leído
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={onClose} className="h-7 w-7">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {loading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground text-sm">
              Cargando...
            </div>
          )}
          {!loading && notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Inbox className="h-10 w-10 opacity-30" />
              <p className="text-sm">Sin notificaciones</p>
            </div>
          )}
          {!loading && notifications.length > 0 && (
            <ul>
              {notifications.map((n) => (
                <li
                  key={n.id}
                  onClick={() => !n.read && markRead(n.id)}
                  className={cn(
                    "flex gap-3 px-4 py-3 border-b border-border/50 cursor-pointer transition-colors hover:bg-muted/50",
                    !n.read && "bg-primary/5"
                  )}
                >
                  <span className="text-lg shrink-0 mt-0.5">
                    {TYPE_ICON[n.type] ?? "🔔"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={cn("text-sm leading-snug", !n.read && "font-medium")}>
                        {n.title}
                      </p>
                      {!n.read && (
                        <span className="mt-1 h-2 w-2 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    {n.body && (
                      <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{n.body}</p>
                    )}
                    <p className="mt-1 text-[10px] text-muted-foreground/70">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true, locale: es })}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </>
  );
}

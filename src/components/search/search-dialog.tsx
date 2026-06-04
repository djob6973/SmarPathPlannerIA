import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, X, Kanban, MessageSquare, BarChart3, Settings } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

type NavResult = { kind: "nav"; label: string; path: string; icon: React.ComponentType<{ className?: string }> };
type RequestResult = { kind: "request"; id: string; title: string; priority: string; status: string | null };
type SearchResult = RequestResult | NavResult;

const NAV_RESULTS: NavResult[] = [
  { kind: "nav", label: "Tablero Kanban", path: "/app/board",    icon: Kanban        },
  { kind: "nav", label: "Chat IA",        path: "/app/chat",     icon: MessageSquare },
  { kind: "nav", label: "Analítica",      path: "/app/analytics",icon: BarChart3     },
  { kind: "nav", label: "Configuración",  path: "/app/settings", icon: Settings      },
];

const PRIORITY_CLASS: Record<string, string> = {
  urgent: "priority-urgent",
  high:   "priority-high",
  medium: "priority-medium",
  low:    "priority-low",
};

interface SearchDialogProps {
  open: boolean;
  onClose: () => void;
}

export function SearchDialog({ open, onClose }: SearchDialogProps) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selected, setSelected] = useState(0);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(NAV_RESULTS);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from("requests")
      .select("id, title, priority, status_column_id")
      .ilike("title", `%${q}%`)
      .limit(8);
    const reqResults: SearchResult[] = (data ?? []).map((r) => ({
      kind: "request" as const,
      id: r.id,
      title: r.title,
      priority: r.priority,
      status: r.status_column_id,
    }));
    const navFiltered = NAV_RESULTS.filter((n) =>
      n.label.toLowerCase().includes(q.toLowerCase())
    );
    setResults([...reqResults, ...navFiltered]);
    setSelected(0);
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 200);
    return () => clearTimeout(timer);
  }, [query, search]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setResults(NAV_RESULTS);
      setSelected(0);
    }
  }, [open]);

  // Keyboard navigation
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
      if (e.key === "ArrowUp")   { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
      if (e.key === "Escape")    { onClose(); }
      if (e.key === "Enter" && results[selected]) {
        const r = results[selected];
        if (r.kind === "nav") navigate({ to: r.path });
        else navigate({ to: "/app/requests" });
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, results, selected, navigate, onClose]);

  // Global Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-24 px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Dialog */}
      <div className="relative w-full max-w-xl rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
        {/* Input */}
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground shrink-0" />
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar solicitudes, páginas..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </button>
          )}
          <kbd className="rounded border border-border px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">ESC</kbd>
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-y-auto py-2">
          {loading && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Buscando...</p>
          )}
          {!loading && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-muted-foreground">Sin resultados para "{query}"</p>
          )}
          {!loading && results.map((r, i) => (
            <button
              key={r.kind === "nav" ? r.path : r.id}
              onClick={() => {
                if (r.kind === "nav") navigate({ to: r.path });
                else navigate({ to: "/app/requests" });
                onClose();
              }}
              onMouseEnter={() => setSelected(i)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-2.5 text-sm transition-colors text-left",
                i === selected ? "bg-accent text-accent-foreground" : "hover:bg-muted/50"
              )}
            >
              {r.kind === "nav" ? (
                <>
                  <r.icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <span className="flex-1">{r.label}</span>
                  <span className="text-xs text-muted-foreground">Ir a →</span>
                </>
              ) : (
                <>
                  <div className="h-4 w-4 shrink-0 rounded border border-border flex items-center justify-center">
                    <span className="text-[10px]">📋</span>
                  </div>
                  <span className="flex-1 truncate">{r.title}</span>
                  <Badge className={cn("text-[10px] px-1.5 py-0.5 font-medium", PRIORITY_CLASS[r.priority])}>
                    {r.priority}
                  </Badge>
                </>
              )}
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2 text-[10px] text-muted-foreground">
          <span><kbd className="font-mono">↑↓</kbd> navegar</span>
          <span><kbd className="font-mono">↵</kbd> seleccionar</span>
          <span><kbd className="font-mono">ESC</kbd> cerrar</span>
        </div>
      </div>
    </div>
  );
}

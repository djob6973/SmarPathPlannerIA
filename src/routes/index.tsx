import { createFileRoute, Link } from "@tanstack/react-router";
import { Zap, Kanban, MessageSquare, BarChart3, Shield, Sparkles, ArrowRight, CheckCircle } from "lucide-react";

export const Route = createFileRoute("/")({
  component: LandingPage,
});

const FEATURES = [
  {
    icon: MessageSquare,
    title: "Chat IA para intake",
    desc: "El agente IA entrevista, estructura y registra solicitudes automáticamente.",
    color: "text-purple-400", bg: "bg-purple-400/10",
  },
  {
    icon: Kanban,
    title: "Tablero Kanban",
    desc: "Gestiona solicitudes con drag & drop, columnas configurables y vistas de lista.",
    color: "text-blue-400", bg: "bg-blue-400/10",
  },
  {
    icon: BarChart3,
    title: "Analítica avanzada",
    desc: "KPIs, distribución por estado, prioridad y actividad de los últimos días.",
    color: "text-emerald-400", bg: "bg-emerald-400/10",
  },
  {
    icon: Sparkles,
    title: "Notificaciones en tiempo real",
    desc: "Alertas instantáneas vía Supabase Realtime cuando cambia el estado de tus solicitudes.",
    color: "text-yellow-400", bg: "bg-yellow-400/10",
  },
  {
    icon: Shield,
    title: "Control de acceso granular",
    desc: "Roles admin, manager, client y viewer con permisos definidos a nivel de base de datos.",
    color: "text-rose-400", bg: "bg-rose-400/10",
  },
  {
    icon: MessageSquare,
    title: "Comentarios e historial",
    desc: "Hilo de comentarios en cada solicitud con seguimiento de cambios de estado.",
    color: "text-indigo-400", bg: "bg-indigo-400/10",
  },
];

const BENEFITS = [
  "Captura de requerimientos conversacional con IA",
  "Drag & drop entre columnas en tiempo real",
  "Búsqueda global con ⌘K",
  "Modo oscuro / claro",
  "Multi-rol con seguridad RLS en Supabase",
  "Gráficos de área, barras y anillos",
];

function LandingPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="border-b border-border/40 bg-background/80 backdrop-blur-md sticky top-0 z-40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/15">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <span className="font-bold">SmartPath</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Iniciar sesión
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 pt-24 pb-20 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-medium text-primary">
          <Sparkles className="h-3 w-3" />
          SmartPath Planner AI
        </div>
        <h1 className="text-5xl font-bold tracking-tight md:text-6xl leading-tight">
          Tu roadmap,{" "}
          <span className="bg-gradient-to-r from-primary to-purple-400 bg-clip-text text-transparent">
            potenciado con IA
          </span>
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Captura solicitudes mediante conversación con un agente inteligente, gestiona el progreso
          en un tablero Kanban moderno y analiza el estado de tu equipo en tiempo real.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <Link
            to="/login"
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-all hover:scale-105"
          >
            Comenzar ahora <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            to="/login"
            className="flex items-center gap-2 rounded-lg border border-border px-6 py-3 text-sm font-medium hover:bg-muted/50 transition-colors"
          >
            Ver demo
          </Link>
        </div>

        {/* Mock UI preview */}
        <div className="mt-8 w-full max-w-4xl rounded-2xl border border-border/50 bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center gap-1.5 border-b border-border/50 bg-muted/30 px-4 py-3">
            <div className="h-3 w-3 rounded-full bg-red-400" />
            <div className="h-3 w-3 rounded-full bg-yellow-400" />
            <div className="h-3 w-3 rounded-full bg-emerald-400" />
            <span className="ml-3 text-xs text-muted-foreground font-mono">smartpath.app/board</span>
          </div>
          <div className="flex gap-0">
            {/* Mini sidebar */}
            <div className="w-12 bg-sidebar border-r border-sidebar-border flex flex-col items-center gap-3 py-4">
              {[Kanban, MessageSquare, BarChart3, Shield].map((Icon, i) => (
                <div key={i} className={`rounded-lg p-1.5 ${i === 0 ? "bg-sidebar-accent" : ""}`}>
                  <Icon className={`h-4 w-4 ${i === 0 ? "text-sidebar-primary" : "text-sidebar-foreground/40"}`} />
                </div>
              ))}
            </div>
            {/* Mini board */}
            <div className="flex-1 p-4 overflow-hidden">
              <div className="flex gap-3">
                {[
                  { name: "Backlog", color: "#6B7280", cards: ["Rediseño landing", "Integración API"] },
                  { name: "En curso", color: "#6366F1", cards: ["Chat IA", "Auth system"] },
                  { name: "Review",  color: "#F59E0B", cards: ["Dashboard"] },
                  { name: "Done",    color: "#10B981", cards: ["DB schema", "RLS"] },
                ].map((col) => (
                  <div key={col.name} className="w-28 shrink-0">
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="h-1.5 w-1.5 rounded-full" style={{ background: col.color }} />
                      <span className="text-[9px] font-medium text-muted-foreground">{col.name}</span>
                    </div>
                    <div className="space-y-1.5">
                      {col.cards.map((c) => (
                        <div key={c} className="rounded-md border border-border/50 bg-background p-1.5">
                          <p className="text-[9px] leading-tight text-foreground/80">{c}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="text-center text-3xl font-bold mb-12">Todo lo que necesitas</h2>
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div key={f.title} className="rounded-xl border border-border/50 bg-card p-5 hover:border-primary/30 transition-colors">
              <div className={`mb-3 inline-flex rounded-lg p-2 ${f.bg}`}>
                <f.icon className={`h-5 w-5 ${f.color}`} />
              </div>
              <h3 className="font-semibold mb-1.5">{f.title}</h3>
              <p className="text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Benefits */}
      <section className="border-y border-border/50 bg-muted/20 py-16">
        <div className="mx-auto max-w-4xl px-6 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <h2 className="text-3xl font-bold mb-4">Diseñado para equipos modernos</h2>
            <p className="text-muted-foreground mb-6">
              SmartPath Planner AI combina lo mejor de la gestión de proyectos tradicional
              con la potencia de la inteligencia artificial.
            </p>
          </div>
          <ul className="space-y-3">
            {BENEFITS.map((b) => (
              <li key={b} className="flex items-center gap-3 text-sm">
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
                {b}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/40 py-8">
        <div className="mx-auto max-w-6xl px-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">SmartPath Planner AI</span>
          </div>
          <p className="text-xs text-muted-foreground">
            © 2026
          </p>
        </div>
      </footer>
    </main>
  );
}

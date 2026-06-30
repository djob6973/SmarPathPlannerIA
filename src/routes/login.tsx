import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useLang } from "@/lib/lang-context";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { t } = useLang();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const form = e.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value;
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;
    const nameEl = form.elements.namedItem("name") as HTMLInputElement | null;
    const name = nameEl?.value || undefined;

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        window.location.href = "/app/dashboard";
      } else {
        setError(data.error ?? t("login.unknownError"));
      }
    } catch {
      setError(t("login.connectionError"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* ── Left panel ── */}
      <div className="relative flex w-full flex-col bg-white px-10 py-10 md:w-[52%] lg:w-[46%]">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1a1a1a]">
            <ChevronIcon />
          </div>
          <div className="leading-none">
            <p className="text-sm font-bold tracking-tight text-[#1a1a1a]">SmartPath</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-gray-400">Planner IA</p>
          </div>
        </div>

        {/* Form area */}
        <div className="flex flex-1 flex-col justify-center py-12">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-[28px] font-bold text-[#1a1a1a]">
              {mode === "login" ? "Bienvenido de vuelta" : "Crear cuenta"}
            </h1>
            <p className="mt-1.5 text-sm text-gray-500">
              {mode === "login"
                ? "Inicia sesión para gestionar tu roadmap, solicitudes y analítica."
                : "Regístrate para empezar a usar SmartPath Planner."}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {mode === "register" && (
                <div>
                  <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                    Nombre
                  </label>
                  <div className="relative">
                    <input
                      id="name"
                      name="name"
                      type="text"
                      placeholder="Tu nombre"
                      className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 px-4 text-sm text-[#1a1a1a] placeholder:text-gray-400 focus:border-[#ED5650] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ED5650]/20 transition-all"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                  Correo electrónico
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    placeholder="tu@email.com"
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-4 text-sm text-[#1a1a1a] placeholder:text-gray-400 focus:border-[#ED5650] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ED5650]/20 transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                    Contraseña
                  </label>
                  {mode === "login" && (
                    <button type="button" className="text-[11px] font-medium text-[#ED5650] hover:underline">
                      ¿Olvidaste tu contraseña?
                    </button>
                  )}
                </div>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    required
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    placeholder="••••••••"
                    minLength={6}
                    className="h-11 w-full rounded-lg border border-gray-200 bg-gray-50 pl-10 pr-10 text-sm text-[#1a1a1a] placeholder:text-gray-400 focus:border-[#ED5650] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ED5650]/20 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {mode === "login" && (
                <label className="flex cursor-pointer items-center gap-2.5">
                  <div
                    onClick={() => setRemember((v) => !v)}
                    className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${
                      remember ? "border-[#ED5650] bg-[#ED5650]" : "border-gray-300 bg-white"
                    }`}
                  >
                    {remember && (
                      <svg viewBox="0 0 10 8" className="h-2.5 w-2.5 fill-none stroke-white stroke-2">
                        <path d="M1 4l2.5 2.5L9 1" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm text-gray-600">Recordar este equipo durante 30 días</span>
                </label>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[#ED5650]">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-lg bg-[#ED5650] text-sm font-semibold text-white shadow-sm hover:bg-[#d94e48] disabled:opacity-60 transition-colors"
              >
                {loading
                  ? "Cargando..."
                  : mode === "login"
                  ? "Iniciar sesión"
                  : "Crear cuenta"}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-gray-500">
              {mode === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
              <button
                type="button"
                onClick={() => { setMode((m) => (m === "login" ? "register" : "login")); setError(null); }}
                className="font-semibold text-[#ED5650] hover:underline"
              >
                {mode === "login" ? "Crear cuenta" : "Iniciar sesión"}
              </button>
            </p>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-[10px] font-medium uppercase tracking-widest text-gray-300">
          SmartPath Planner · Planificación con IA
        </p>
      </div>

      {/* ── Right panel ── */}
      <div className="relative hidden flex-col overflow-hidden bg-[#1a1a1a] md:flex md:w-[48%] lg:w-[54%]">
        {/* Decorative chevron background */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-end overflow-hidden opacity-[0.06]">
          <svg viewBox="0 0 500 600" className="h-full w-auto" fill="none">
            <g fill="#ED5650">
              <path d="M120 80 L240 300 L120 520 L160 520 L280 300 L160 80Z" />
              <path d="M220 80 L340 300 L220 520 L260 520 L380 300 L260 80Z" />
              <path d="M320 80 L440 300 L320 520 L360 520 L480 300 L360 80Z" />
            </g>
          </svg>
        </div>

        {/* Large decorative chevrons — right edge */}
        <div className="pointer-events-none absolute right-0 top-0 h-full opacity-[0.04]">
          <svg viewBox="0 0 300 800" className="h-full" fill="none">
            <path d="M60 0 L240 400 L60 800 L120 800 L300 400 L120 0Z" fill="#ffffff" />
          </svg>
        </div>

        <div className="relative flex flex-1 flex-col justify-between px-14 py-12">
          {/* Top label */}
          <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-gray-500">
            Sistema // Planificación
          </p>

          {/* Main content */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#ED5650]/15 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ED5650]" />
              <span className="text-[11px] font-semibold uppercase tracking-widest text-[#ED5650]">
                Impulsado por IA
              </span>
            </div>

            <h2 className="text-[36px] font-bold leading-tight text-white lg:text-[42px]">
              Convierte cada solicitud en un roadmap claro y priorizado.
            </h2>

            <div className="mt-4 h-0.5 w-12 bg-[#ED5650]" />

            <p className="mt-5 text-sm leading-relaxed text-gray-400">
              SmartPath Planner organiza tus solicitudes, prioriza iniciativas y te muestra el avance — con un agente que te guía paso a paso.
            </p>

            <ul className="mt-8 space-y-4">
              {[
                "Nueva solicitud guiada por el agente de IA",
                "Tablero por estado y priorización automática",
                "Analítica de KPIs y tendencias en tiempo real",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="shrink-0 text-[13px] font-bold text-[#ED5650]">{">>"}</span>
                  <span className="text-sm text-gray-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
                <ChevronIcon small />
              </div>
              <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-500">
                SmartPath Planner
              </span>
            </div>
            <span className="text-[11px] font-medium text-gray-600">2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChevronIcon({ small = false }: { small?: boolean }) {
  const s = small ? 14 : 20;
  return (
    <svg width={s} height={s} viewBox="0 0 20 20" fill="none">
      <path d="M11.5 4L7 10L11.5 16" stroke="#ED5650" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15.5 4L11 10L15.5 16" stroke="#ED5650" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

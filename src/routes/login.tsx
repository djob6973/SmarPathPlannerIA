import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Eye, EyeOff, Mail, Lock } from "lucide-react";
import { useLang } from "@/lib/lang-context";
import { getPublicLogoUrl } from "@/lib/settings.functions";

export const Route = createFileRoute("/login")({
  loader: async () => {
    try {
      const { value } = await getPublicLogoUrl();
      return { logoUrl: value };
    } catch {
      return { logoUrl: null };
    }
  },
  component: LoginPage,
});

function LoginPage() {
  const { t } = useLang();
  const { logoUrl } = Route.useLoaderData();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);

  useEffect(() => {
    if (!logoUrl) return;
    let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
    if (!link) {
      link = document.createElement("link");
      document.head.appendChild(link);
    }
    link.rel = "icon";
    link.href = logoUrl;
    link.type = logoUrl.endsWith(".svg") ? "image/svg+xml" : "image/png";
  }, [logoUrl]);

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
          <div className="flex items-center justify-center">
            {logoUrl
              ? <img src={logoUrl} alt="Logo" style={{ height: 40, width: "auto", maxWidth: 52, objectFit: "contain" }} />
              : <DataicoMark size={36} />}
          </div>
          <div className="leading-none">
            <p className="text-base font-bold tracking-tight text-[#1a1a1a]">SmartPath</p>
            <p className="font-mono text-[9px] uppercase tracking-widest text-gray-400">Planner IA</p>
          </div>
        </div>

        {/* Form area */}
        <div className="flex flex-1 flex-col justify-center py-12">
          <div className="mx-auto w-full max-w-sm">
            <h1 className="text-[30px] font-semibold tracking-[-0.01em] text-[#1a1a1a]">
              {mode === "login" ? "Bienvenido de vuelta" : "Crear cuenta"}
            </h1>
            <p className="mt-1.5 text-[14px] leading-relaxed text-gray-500">
              {mode === "login"
                ? "Inicia sesión para gestionar tu roadmap, solicitudes y analítica."
                : "Regístrate para empezar a usar SmartPath Planner."}
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {mode === "register" && (
                <div>
                  <label className="mb-1.5 block font-mono text-[10px] font-bold uppercase tracking-[.12em] text-gray-500">
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
                  <label className="font-mono text-[10px] font-bold uppercase tracking-[.12em] text-gray-500">
                    Contraseña
                  </label>
                  {mode === "login" && (
                    <button type="button" className="text-[12px] font-medium text-[#ED5650] hover:underline">
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
                  <span className="text-[13px] text-gray-600">Recordar este equipo durante 30 días</span>
                </label>
              )}

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-[#ED5650]">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="h-11 w-full rounded-lg bg-[#ED5650] text-[14px] font-semibold text-white shadow-sm hover:bg-[#d94e48] disabled:opacity-60 transition-colors"
              >
                {loading
                  ? "Cargando..."
                  : mode === "login"
                  ? "Iniciar sesión"
                  : "Crear cuenta"}
              </button>
            </form>

            <p className="mt-6 text-center text-[13px] text-gray-500">
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
        <p className="text-center font-mono text-[9px] uppercase tracking-widest text-gray-300">
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
          <p className="font-mono text-[10px] uppercase tracking-[.2em] text-gray-500">
            Sistema // Planificación
          </p>

          {/* Main content */}
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-[#ED5650]/15 px-3.5 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ED5650]" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-[#ED5650]">
                Impulsado por IA
              </span>
            </div>

            <h2 className="text-[48px] font-bold leading-[1.1] tracking-[-0.02em] text-white">
              Convierte cada solicitud en un roadmap claro y priorizado.
            </h2>

            <div className="mt-4 h-0.5 w-12 bg-[#ED5650]" />

            <p className="mt-5 text-[14px] leading-relaxed text-gray-400">
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
                  <span className="text-[13px] text-gray-300">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Bottom */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/10">
                {logoUrl
                  ? <img src={logoUrl} alt="Logo" style={{ height: 16, width: "auto", objectFit: "contain", filter: "brightness(0.7)" }} />
                  : <DataicoMark size={14} />}
              </div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-gray-500">
                SmartPath Planner
              </span>
            </div>
            <span className="font-mono text-[10px] uppercase tracking-widest text-gray-600">© 2026</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function DataicoMark({ size = 24 }: { size?: number }) {
  const w = Math.round(size * (94 / 72));
  return (
    <svg viewBox="0 0 94 72" width={w} height={size} fill="#ED5650">
      <path d="M3 36C3 17 16 3 33 3c5 0 9 2 12 6C37 11 28 22 25 36H3z"/>
      <path d="M3 36C3 55 16 69 33 69c5 0 9-2 12-6C37 61 28 50 25 36H3z"/>
      <path d="M50 36C50 17 63 3 80 3c5 0 9 2 12 6C84 11 75 22 72 36H50z"/>
      <path d="M50 36C50 55 63 69 80 69c5 0 9-2 12-6C84 61 75 50 72 36H50z"/>
    </svg>
  );
}

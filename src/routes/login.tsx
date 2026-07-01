import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Eye, EyeOff, Mail, Lock, Check, ArrowLeft } from "lucide-react";
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
  head: () => ({
    meta: [
      { title: "Iniciar sesión — SmartPath Planner" },
      { name: "description", content: "Inicia sesión en SmartPath Planner, el sistema de roadmap inteligente con IA." },
    ],
  }),
  component: LoginPage,
});

const FEATURES = [
  "Solicitud asistida IA",
  "Tablero por estado y priorización automática",
  "Analítica de KPIs y tendencias en tiempo real",
];

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

  function switchMode(next: "login" | "register") {
    setMode(next);
    setError(null);
  }

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

  const isLogin = mode === "login";

  return (
    <div className="grid min-h-screen w-full lg:grid-cols-2">
      {/* ── Left panel ── */}
      <div className="flex flex-col bg-[#F5F5F5] px-6 pt-6 pb-4 sm:px-8 sm:pt-8 sm:pb-6 md:px-12 md:pt-12 md:pb-8">
        {/* Logo / Back */}
        {isLogin ? (
          <div className="mb-6 flex items-center gap-2.5 sm:mb-10">
            <div className="flex items-center justify-center">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="h-9 max-w-[80px] shrink-0 object-contain"
                />
              ) : (
                <div
                  className="flex size-9 items-center justify-center rounded-[10px]"
                  style={{ background: "#1a1a1a", color: "#fff" }}
                >
                  <DataicoMark size={16} />
                </div>
              )}
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-base font-bold tracking-tight text-[#1a1a1a]">SmartPath</span>
              <span className="mt-[3px] font-mono text-[9px] uppercase tracking-widest text-gray-400">
                Planner IA
              </span>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => switchMode("login")}
            className="mb-6 flex items-center gap-1.5 text-[13px] text-gray-500 hover:text-[#1a1a1a] sm:mb-10"
          >
            <ArrowLeft className="size-4" strokeWidth={1.5} />
            Volver
          </button>
        )}

        {/* Form area */}
        <div className="mx-auto w-full max-w-[360px] flex-1 flex flex-col justify-start">
          <h1 className="text-[22px] font-semibold leading-[1.2] tracking-[-0.01em] text-[#1a1a1a] sm:text-[26px]">
            {isLogin ? "Bienvenido de vuelta" : "Crear cuenta"}
          </h1>
          <p className="mt-2 text-[13px] leading-relaxed text-gray-500">
            {isLogin
              ? "Inicia sesión para gestionar tu roadmap, solicitudes y analítica."
              : "Regístrate para empezar a usar SmartPath Planner."}
          </p>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3.5">
            {error && (
              <div className="rounded-lg bg-red-50 px-3 py-2.5 text-sm text-[#ED5650]">
                {error}
              </div>
            )}

            {/* Full name — register only */}
            {!isLogin && (
              <div className="space-y-1.5">
                <label htmlFor="name" className="block text-[10px] font-bold uppercase tracking-[.12em] text-gray-500">
                  Nombre
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  placeholder="Tu nombre"
                  disabled={loading}
                  className="h-11 w-full rounded-xl border-transparent bg-white px-4 text-sm text-[#1a1a1a] shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ED5650]/20 transition-all"
                />
              </div>
            )}

            {/* Email */}
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-[10px] font-bold uppercase tracking-[.12em] text-gray-500">
                Correo electrónico
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 size-[15px] text-gray-400" strokeWidth={1.5} />
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="tu@email.com"
                  disabled={loading}
                  className="h-11 w-full rounded-xl border-transparent bg-white pl-9 text-sm text-[#1a1a1a] shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ED5650]/20 transition-all"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-[10px] font-bold uppercase tracking-[.12em] text-gray-500">
                  Contraseña
                </label>
                {isLogin && (
                  <button type="button" className="text-[12px] font-medium text-[#ED5650] hover:underline">
                    ¿Olvidaste tu contraseña?
                  </button>
                )}
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 size-[15px] text-gray-400" strokeWidth={1.5} />
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete={isLogin ? "current-password" : "new-password"}
                  placeholder="••••••••"
                  minLength={6}
                  disabled={loading}
                  className="h-11 w-full rounded-xl border-transparent bg-white pl-9 pr-9 text-sm text-[#1a1a1a] shadow-sm placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#ED5650]/20 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword
                    ? <EyeOff className="size-[15px]" strokeWidth={1.5} />
                    : <Eye className="size-[15px]" strokeWidth={1.5} />}
                </button>
              </div>
            </div>

            {/* Remember device */}
            {isLogin && (
              <label className="flex cursor-pointer items-start gap-2.5">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={remember}
                  onClick={() => setRemember((v) => !v)}
                  className={
                    "mt-0.5 flex size-[18px] shrink-0 items-center justify-center rounded-[6px] transition-colors " +
                    (remember ? "bg-[#ED5650]" : "border border-gray-300 bg-white")
                  }
                >
                  {remember && <Check className="size-3 text-white" strokeWidth={3} />}
                </button>
                <span className="text-[13px] text-gray-500">
                  Recordar este equipo durante 30 días
                </span>
              </label>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full py-3.5 text-[14px] font-semibold text-white shadow-sm transition-colors disabled:opacity-60"
              style={{ background: "#ED5650" }}
            >
              {loading ? "Cargando..." : isLogin ? "Iniciar sesión" : "Crear cuenta"}
            </button>
          </form>

          {/* Switch mode */}
          {isLogin && (
            <p className="mt-6 text-center text-[13px] text-gray-500">
              ¿No tienes cuenta?{" "}
              <button
                type="button"
                onClick={() => switchMode("register")}
                className="font-semibold text-[#ED5650] hover:underline"
              >
                Crear cuenta
              </button>
            </p>
          )}
        </div>

        <p className="text-left font-mono text-[9px] uppercase tracking-widest text-gray-300">
          SmartPath Planner · Planificación con IA
        </p>
      </div>

      {/* ── Right panel ── */}
      <div
        className="relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-start px-8 pb-6 pt-12 lg:px-12 lg:pb-8 xl:pt-20"
        style={{ background: "#1a1a1a", color: "#F1F1F1" }}
      >
        {/* Chevron pattern background */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
          {Array.from({ length: 7 }).map((_, row) => (
            <div key={row} className="flex" style={{ marginTop: row === 0 ? 80 : 0 }}>
              {Array.from({ length: 5 }).map((_, col) => (
                <span
                  key={col}
                  className="font-bold text-white/[0.035]"
                  style={{ fontSize: 120, lineHeight: 1.1, letterSpacing: "-0.02em" }}
                >
                  »
                </span>
              ))}
            </div>
          ))}
        </div>

        {/* Top label */}
        <div className="relative font-mono text-[10px] uppercase tracking-[.2em] text-white/40 mb-6 lg:mb-10">
          Sistema // Planificación
        </div>

        {/* Hero content */}
        <div className="relative max-w-[420px] space-y-4 xl:max-w-[560px]">
          <div
            className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider"
            style={{ background: "rgba(237,86,80,.18)", color: "#ED5650" }}
          >
            <span className="size-1.5 rounded-full bg-[#ED5650]" />
            Impulsado por IA
          </div>

          <h2
            className="max-w-full text-[22px] font-bold leading-[1.2] tracking-[-0.02em] text-white xl:max-w-[480px] xl:text-[30px]"
            style={{ whiteSpace: "pre-line" }}
          >
            {"De una idea a una solicitud\nlista para gestionar.\nNuestro asistente IA recopila\nel contexto y la crea por ti."}
          </h2>

          <div className="h-[3px] w-10 rounded-full bg-[#ED5650]" />

          <p className="max-w-full text-[13px] leading-relaxed text-white/55 xl:max-w-[360px]">
            SmartPath Planner organiza tus solicitudes, prioriza iniciativas y te muestra el avance — con un agente que te guía paso a paso.
          </p>

          <ul className="space-y-3 pt-1">
            {FEATURES.map((feat, i) => (
              <li key={i} className="flex items-start gap-3">
                <span className="mt-0.5 font-bold text-[#ED5650] text-[13px]">{">>"}</span>
                <span className="text-[13px] text-white/70">{feat}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom */}
        <div className="relative mt-auto font-mono text-[10px] uppercase tracking-widest text-white/30">
          © 2026 SmartPath Planner
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

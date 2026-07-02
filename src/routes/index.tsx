import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getPublicLogoUrl } from "@/lib/settings.functions";

const SPLASH_MS = 1100;

// The whole domain sits behind Dokku's perimeter SSO — reaching this route at
// all means the user is already authenticated, so there's nothing to gate
// here. This is a brief branded splash, not a screen that needs a click.
export const Route = createFileRoute("/")({
  loader: async () => {
    try {
      const { value } = await getPublicLogoUrl();
      return { logoUrl: value };
    } catch {
      return { logoUrl: null };
    }
  },
  component: SplashPage,
});

function SplashPage() {
  const { logoUrl } = Route.useLoaderData();
  const navigate = useNavigate();

  useEffect(() => {
    const timer = setTimeout(() => navigate({ to: "/app/dashboard" }), SPLASH_MS);
    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <div
      onClick={() => navigate({ to: "/app/dashboard" })}
      className="relative flex min-h-screen cursor-pointer flex-col items-center justify-center overflow-hidden px-6"
      style={{ background: "#1a1a1a", color: "#F1F1F1" }}
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden select-none" aria-hidden>
        {Array.from({ length: 7 }).map((_, row) => (
          <div key={row} className="flex items-center" style={{ marginTop: row === 0 ? 60 : 0 }}>
            {Array.from({ length: 5 }).map((_, col) =>
              logoUrl ? (
                <img
                  key={col}
                  src={logoUrl}
                  alt=""
                  className="object-contain opacity-[0.06]"
                  style={{ width: 120, height: 110, padding: "18px" }}
                />
              ) : (
                <span
                  key={col}
                  className="font-bold text-white/[0.035]"
                  style={{ fontSize: 120, lineHeight: 1.1, letterSpacing: "-0.02em" }}
                >
                  »
                </span>
              )
            )}
          </div>
        ))}
      </div>

      <div className="relative flex flex-col items-center text-center">
        <div className="mb-8 flex items-center gap-2.5">
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" className="h-9 max-w-[80px] shrink-0 object-contain" />
          ) : (
            <div
              className="flex size-9 items-center justify-center rounded-[10px]"
              style={{ background: "#ED5650", color: "#fff" }}
            >
              <DataicoMark size={16} />
            </div>
          )}
          <div className="flex flex-col items-start leading-none">
            <span className="text-base font-bold tracking-tight text-white">SmartPath</span>
            <span className="mt-[3px] font-mono text-[9px] uppercase tracking-widest text-white/40">
              Planner IA
            </span>
          </div>
        </div>

        <h1
          className="max-w-[560px] text-[22px] font-bold leading-[1.25] tracking-[-0.02em] text-white sm:text-[27px]"
          style={{ whiteSpace: "pre-line" }}
        >
          {"De una idea a una solicitud\nlista para gestionar.\nNuestro asistente IA recopila\nel contexto y la crea por ti."}
        </h1>

        <div className="mt-8 h-[2px] w-24 overflow-hidden rounded-full bg-white/10">
          <div className="h-full w-full origin-left animate-[splash-progress_1.1s_ease-in-out_forwards] rounded-full bg-[#ED5650]" />
        </div>
      </div>

      <style>{`
        @keyframes splash-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
      `}</style>
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

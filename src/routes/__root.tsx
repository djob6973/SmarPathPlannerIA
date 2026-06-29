import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet, Link, createRootRouteWithContext,
  useRouter, HeadContent, Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useLang } from "../lib/lang-context";
import { translations } from "../locales/translations";

// Safe hook usable outside LangProvider (404/error boundaries render before the provider)
function useLangSafe() {
  try { return useLang(); } catch {
    const t = (key: string) => {
      const parts = key.split(".");
      let cur: any = translations.es;
      for (const p of parts) cur = cur?.[p];
      return typeof cur === "string" ? cur : key;
    };
    return { t };
  }
}
import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { AuthProvider } from "../lib/auth-context";
import { ThemeProvider } from "../lib/theme-context";
import { LangProvider } from "../lib/lang-context";
import { Toaster } from "../components/ui/sonner";
import { getCurrentUser, type CurrentUser } from "../lib/auth.functions";

function NotFoundComponent() {
  const { t } = useLangSafe();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-7xl font-bold text-primary">404</p>
        <h2 className="mt-4 text-xl font-semibold">{t("notFound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("notFound.message")}</p>
        <Link to="/" className="mt-6 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
          {t("common.goHome")}
        </Link>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const { t } = useLangSafe();
  useEffect(() => { reportLovableError(error, { boundary: "tanstack_root_error_component" }); }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="text-4xl">⚠️</p>
        <h1 className="mt-4 text-xl font-semibold">{t("errorPage.title")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("errorPage.message")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {t("errorPage.retry")}
          </button>
          <a href="/" className="inline-flex items-center justify-center rounded-lg border border-input bg-background px-4 py-2 text-sm font-medium hover:bg-accent transition-colors">
            {t("common.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "SmartPath Planner AI" },
      { name: "description", content: "Sistema de roadmap inteligente con IA, Kanban y analítica." },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300..700&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
    ],
  }),
  // Load the current user server-side so oauth2-proxy's X-Forwarded-Email
  // header is available (SSR request goes through the proxy; client fetch calls may not).
  loader: async (): Promise<{ currentUser: CurrentUser | null }> => {
    try {
      const currentUser = await getCurrentUser();
      return { currentUser };
    } catch {
      return { currentUser: null };
    }
  },
  // Never re-fetch on client-side navigation — SSR data is authoritative.
  staleTime: Infinity,
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <head><HeadContent /></head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const { currentUser } = Route.useLoaderData();
  return (
    <QueryClientProvider client={queryClient}>
      <LangProvider>
        <ThemeProvider>
          <AuthProvider initialUser={currentUser}>
            <Outlet />
            <Toaster richColors position="top-right" />
          </AuthProvider>
        </ThemeProvider>
      </LangProvider>
    </QueryClientProvider>
  );
}

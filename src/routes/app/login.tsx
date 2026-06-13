import { createFileRoute, redirect } from "@tanstack/react-router";

// Catch-all for any redirect that lands on /app/login (oauth2-proxy callback or legacy links).
export const Route = createFileRoute("/app/login")({
  beforeLoad: () => {
    throw redirect({ to: "/app/dashboard" });
  },
  component: () => null,
});

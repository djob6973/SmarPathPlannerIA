import { createFileRoute, redirect } from "@tanstack/react-router";

// Auth is handled by the platform (Google SSO via oauth2-proxy).
// There is no login page — redirect straight to the app.
export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    throw redirect({ to: "/app/dashboard" });
  },
  component: () => null,
});

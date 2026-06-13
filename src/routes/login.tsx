import { createFileRoute } from "@tanstack/react-router";

// Send users directly to oauth2-proxy. After Google auth the proxy redirects
// to tokens.apps.dataico.world where X-Forwarded-Email is always injected.
export const Route = createFileRoute("/login")({
  component: LoginRedirect,
});

function LoginRedirect() {
  if (typeof window !== "undefined") {
    window.location.replace("/api/auth/signin");
  }
  return null;
}

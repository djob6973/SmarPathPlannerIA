import { createFileRoute } from "@tanstack/react-router";

// Auth is handled by the platform (Google SSO via oauth2-proxy).
// Redirect the browser directly to /app/dashboard via a real HTTP navigation —
// oauth2-proxy intercepts the request, stores the return URL automatically,
// and redirects back here after Google authentication completes.
export const Route = createFileRoute("/login")({
  component: LoginRedirect,
});

function LoginRedirect() {
  if (typeof window !== "undefined") {
    window.location.replace("/app/dashboard");
  }
  return null;
}

import { createFileRoute } from "@tanstack/react-router";

// Auth is handled by the platform (Google SSO via oauth2-proxy).
// Force a real HTTP redirect so oauth2-proxy can capture the rd= parameter
// and send the user back to /app/dashboard after Google authentication.
export const Route = createFileRoute("/login")({
  component: LoginRedirect,
});

function LoginRedirect() {
  if (typeof window !== "undefined") {
    window.location.href = "/oauth2/sign_in?rd=/app/dashboard";
  }
  return null;
}

// Auth middleware — replaced from Supabase JWT to header-based (X-Forwarded-Email).
// The Dokku platform's nginx/oauth2-proxy adds X-Forwarded-Email to every request.
import { createMiddleware } from "@tanstack/react-start";
import { getAuthContext } from "@/lib/server-auth";
import { db } from "@/lib/db";

export const requireSupabaseAuth = createMiddleware({ type: "function" }).server(
  async ({ next }) => {
    const auth = await getAuthContext();
    if ("error" in auth) {
      throw new Error(auth.error);
    }
    return next({
      context: {
        // expose db and userId so existing server functions don't need changes
        supabase: null,
        db: auth.db,
        userId: auth.userId,
        userEmail: auth.userEmail,
        userProfile: auth.userProfile,
      },
    });
  }
);

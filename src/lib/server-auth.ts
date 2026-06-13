import { getRequest } from "@tanstack/react-start/server";
import { db } from "./db";
import { runMigrations } from "./migrate";

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  area_id: string | null;
}

export interface AuthContext {
  db: typeof db;
  userId: string;
  userEmail: string;
  userProfile: UserProfile;
}

export interface AuthError {
  error: string;
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export async function getAuthContext(): Promise<AuthContext | AuthError> {
  await runMigrations();

  const req = getRequest();

  // 1. X-Forwarded-Email from oauth2-proxy (if platform puts the app behind it)
  const forwardedEmail =
    req?.headers?.get("x-forwarded-email") ??
    process.env.DEV_USER_EMAIL ??
    null;

  if (forwardedEmail) {
    try {
      const profile = await getOrCreateProfile(forwardedEmail);
      return { db, userId: profile.id, userEmail: forwardedEmail, userProfile: profile };
    } catch (e: any) {
      console.error("[server-auth] header auth error:", e?.message ?? e);
      return { error: "Error de autenticación en el servidor" };
    }
  }

  // 2. Session cookie from the app's own Google OAuth flow
  const cookieHeader = req?.headers?.get("cookie") ?? null;
  const sessionId = parseCookie(cookieHeader, "smartpath_session");

  if (!sessionId) {
    return { error: "No autenticado" };
  }

  try {
    const sessions = await db<{ user_id: string }[]>`
      SELECT user_id FROM sessions
      WHERE id = ${sessionId}
        AND expires_at > NOW()
    `;
    if (!sessions.length) return { error: "Sesión expirada o inválida" };

    const profiles = await db<UserProfile[]>`
      SELECT id, full_name, email, area_id FROM profiles WHERE id = ${sessions[0].user_id}
    `;
    if (!profiles.length) return { error: "Perfil no encontrado" };

    const profile = profiles[0];
    return { db, userId: profile.id, userEmail: profile.email, userProfile: profile };
  } catch (e: any) {
    console.error("[server-auth] session auth error:", e?.message ?? e);
    return { error: "Error de sesión" };
  }
}

export async function getOrCreateProfile(email: string): Promise<UserProfile> {
  const rows = await db<UserProfile[]>`
    SELECT id, full_name, email, area_id FROM profiles WHERE email = ${email}
  `;

  if (rows.length > 0) return rows[0];

  // First user ever → super_admin; otherwise → client
  const [{ count }] = await db<[{ count: string }]>`
    SELECT COUNT(*)::text AS count FROM user_roles_smart_path
  `;
  const isFirst = count === "0";

  const defaultAreaId = isFirst
    ? null
    : (
        await db<[{ id: string }]>`
          SELECT id FROM areas ORDER BY created_at LIMIT 1
        `
      )[0]?.id ?? null;

  const [created] = await db<UserProfile[]>`
    INSERT INTO profiles (full_name, email, area_id)
    VALUES (${email.split("@")[0]}, ${email}, ${defaultAreaId})
    RETURNING id, full_name, email, area_id
  `;

  const role = isFirst ? "super_admin" : "client";
  await db`
    INSERT INTO user_roles_smart_path (user_id, role)
    VALUES (${created.id}, ${role})
    ON CONFLICT (user_id, role) DO NOTHING
  `;

  return created;
}

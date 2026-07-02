// Identity comes from Dokku's perimeter (oauth2-proxy in front of
// apps.dataico.world), which verifies Google SSO and injects X-Forwarded-Email
// on every request — nginx strips/overwrites any client-supplied value, so it
// can be trusted as-is. There is no app-level login: no page, no form, no
// session cookie of our own. X-Forwarded-User is NOT a display name on this
// platform (it's a numeric Google subject id) — never use it for that.
import { getRequest } from "@tanstack/react-start/server";
import { db } from "./db";
import { runMigrations } from "./migrate";

export interface UserProfile {
  id: string;
  full_name: string | null;
  email: string;
  area_id: string | null;
  is_active: boolean;
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

// Emails in ADMIN_EMAILS always get super_admin, re-affirmed on every
// request — so a named admin account can never end up locked out with no
// role, regardless of when they first showed up.
export function isAdminEmail(email: string): boolean {
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase().trim());
}

export async function ensureAdminRole(userId: string): Promise<void> {
  await db`
    INSERT INTO user_roles_smart_path (user_id, role)
    VALUES (${userId}, 'super_admin')
    ON CONFLICT (user_id, role) DO NOTHING
  `;
}

export async function getAuthContext(): Promise<AuthContext | AuthError> {
  await runMigrations();

  const req = getRequest();
  const forwardedEmail = req?.headers?.get("x-forwarded-email");
  // No perimeter in local dev — fall back to a fixed identity for testing.
  const devEmail = process.env.NODE_ENV !== "production" ? process.env.DEV_USER_EMAIL : null;
  const email = (forwardedEmail || devEmail)?.toLowerCase().trim();

  if (!email) return { error: "No autenticado" };

  try {
    const profile = await getOrCreateProfile(email);
    if (!profile.is_active) {
      return { error: "Tu cuenta está desactivada. Contacta al administrador." };
    }
    return { db, userId: profile.id, userEmail: email, userProfile: profile };
  } catch (e: any) {
    console.error("[server-auth] error:", e?.message ?? e);
    return { error: "Error de autenticación en el servidor" };
  }
}

export async function getOrCreateProfile(email: string): Promise<UserProfile> {
  const rows = await db<UserProfile[]>`
    SELECT id, full_name, email, area_id, is_active FROM profiles WHERE email = ${email}
  `;

  if (rows.length > 0) {
    if (isAdminEmail(email)) await ensureAdminRole(rows[0].id);
    return rows[0];
  }

  // First user ever, or a configured admin email → super_admin immediately.
  // Everyone else starts with no role and no area — a Super Admin assigns both.
  const [{ count }] = await db<[{ count: string }]>`
    SELECT COUNT(*)::text AS count FROM user_roles_smart_path
  `;
  const isFirst = count === "0";
  const forceAdmin = isFirst || isAdminEmail(email);

  const autoName = email
    .split("@")[0]
    .replace(/[._]/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();

  const [created] = await db<UserProfile[]>`
    INSERT INTO profiles (full_name, email, area_id)
    VALUES (${autoName}, ${email}, ${null})
    RETURNING id, full_name, email, area_id, is_active
  `;

  if (forceAdmin) {
    await ensureAdminRole(created.id);
  } else {
    const admins = await db<{ id: string }[]>`
      SELECT DISTINCT user_id AS id FROM user_roles_smart_path
      WHERE role IN ('super_admin', 'area_admin')
    `;
    for (const admin of admins) {
      await db`
        INSERT INTO notifications (user_id, type, title, body, data)
        VALUES (
          ${admin.id},
          'user_registered',
          'Nuevo usuario registrado',
          ${`${autoName} (${email}) inició sesión por primera vez. Asigna su rol y área para que pueda acceder al sistema.`},
          ${JSON.stringify({ userId: created.id })}::jsonb
        )
      `;
    }
  }

  return created;
}

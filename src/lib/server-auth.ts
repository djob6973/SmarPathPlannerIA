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

export async function getAuthContext(): Promise<AuthContext | AuthError> {
  await runMigrations();

  const req = getRequest();
  const email =
    req?.headers?.get("x-forwarded-email") ??
    process.env.DEV_USER_EMAIL ??
    null;

  if (!email) {
    return { error: "No autenticado: falta X-Forwarded-Email" };
  }

  try {
    const profile = await getOrCreateProfile(email);
    return { db, userId: profile.id, userEmail: email, userProfile: profile };
  } catch (e: any) {
    console.error("[server-auth] getAuthContext error:", e?.message ?? e);
    return { error: "Error de autenticación en el servidor" };
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

import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { db } from "./db";
import { runMigrations } from "./migrate";

const scryptAsync = promisify(scrypt);
const SESSION_DAYS = 30;

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${salt}:${hash.toString("hex")}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hashHex] = stored.split(":");
  if (!salt || !hashHex) return false;
  const hash = (await scryptAsync(password, salt, 64)) as Buffer;
  const storedHash = Buffer.from(hashHex, "hex");
  return timingSafeEqual(hash, storedHash);
}

function parseCookie(header: string | null, name: string): string | null {
  if (!header) return null;
  const match = header.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function makeCookie(sessionId: string, isHttps: boolean): string {
  const maxAge = SESSION_DAYS * 24 * 3600;
  return [
    `smartpath_session=${sessionId}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${maxAge}`,
    isHttps ? "Secure" : "",
  ]
    .filter(Boolean)
    .join("; ");
}

function json(body: object, init?: ResponseInit): Response {
  return new Response(JSON.stringify(body), {
    ...init,
    headers: { "Content-Type": "application/json", ...((init?.headers as Record<string, string>) ?? {}) },
  });
}

async function createSession(userId: string): Promise<string> {
  const [session] = await db<[{ id: string }]>`
    INSERT INTO sessions (user_id, expires_at)
    VALUES (${userId}, NOW() + (${SESSION_DAYS} * INTERVAL '1 day'))
    RETURNING id
  `;
  return session.id;
}

export async function handleLogin(request: Request): Promise<Response> {
  try {
    await runMigrations();
    const { email, password } = (await request.json()) as { email: string; password: string };

    if (!email || !password) {
      return json({ error: "Email y contraseña son requeridos" }, { status: 400 });
    }

    const rows = await db`
      SELECT id, password_hash FROM profiles WHERE email = ${email.toLowerCase().trim()}
    `;

    if (!rows.length || !rows[0].password_hash) {
      return json({ error: "Email o contraseña incorrectos" }, { status: 401 });
    }

    const valid = await verifyPassword(password, rows[0].password_hash);
    if (!valid) return json({ error: "Email o contraseña incorrectos" }, { status: 401 });

    const sessionId = await createSession(rows[0].id);
    const isHttps = new URL(request.url).protocol === "https:";

    return json({ ok: true }, { headers: { "Set-Cookie": makeCookie(sessionId, isHttps) } });
  } catch (e) {
    console.error("[auth/login]", e);
    return json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function handleRegister(request: Request): Promise<Response> {
  try {
    await runMigrations();
    const { email, password, name } = (await request.json()) as {
      email: string;
      password: string;
      name?: string;
    };

    if (!email || !password) {
      return json({ error: "Email y contraseña son requeridos" }, { status: 400 });
    }
    if (password.length < 6) {
      return json({ error: "La contraseña debe tener al menos 6 caracteres" }, { status: 400 });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db`SELECT id FROM profiles WHERE email = ${normalizedEmail}`;
    if (existing.length) {
      return json({ error: "Este email ya está registrado" }, { status: 400 });
    }

    const passwordHash = await hashPassword(password);

    const [{ count }] = await db`SELECT COUNT(*)::text AS count FROM user_roles_smart_path`;
    const isFirst = count === "0";
    const defaultArea = isFirst
      ? null
      : (await db`SELECT id FROM areas ORDER BY created_at LIMIT 1`)[0]?.id ?? null;

    const [profile] = await db<[{ id: string }]>`
      INSERT INTO profiles (full_name, email, area_id, password_hash)
      VALUES (
        ${name?.trim() || normalizedEmail.split("@")[0]},
        ${normalizedEmail},
        ${defaultArea},
        ${passwordHash}
      )
      RETURNING id
    `;

    await db`
      INSERT INTO user_roles_smart_path (user_id, role)
      VALUES (${profile.id}, ${isFirst ? "super_admin" : "client"})
      ON CONFLICT (user_id, role) DO NOTHING
    `;

    const sessionId = await createSession(profile.id);
    const isHttps = new URL(request.url).protocol === "https:";

    return json({ ok: true }, { headers: { "Set-Cookie": makeCookie(sessionId, isHttps) } });
  } catch (e) {
    console.error("[auth/register]", e);
    return json({ error: "Error del servidor" }, { status: 500 });
  }
}

export async function handleSignout(request: Request): Promise<Response> {
  const sessionId = parseCookie(request.headers.get("cookie"), "smartpath_session");
  if (sessionId) {
    await db`DELETE FROM sessions WHERE id = ${sessionId}`.catch(() => {});
  }
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/login",
      "Set-Cookie": "smartpath_session=; Path=/; HttpOnly; Max-Age=0",
    },
  });
}

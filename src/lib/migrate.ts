import { db } from "./db";

// Runs once per process. Safe to call on every request — resolves instantly after first run.
let done = false;
let pending: Promise<void> | null = null;

export function runMigrations(): Promise<void> {
  if (done) return Promise.resolve();
  if (!pending) {
    pending = _run()
      .then(() => { done = true; })
      .catch((err) => {
        console.error("[migrate] Migration failed:", err);
        pending = null; // allow retry on next request
        throw err;
      });
  }
  return pending;
}

async function _run() {
  console.log("[migrate] Running database migrations...");

  // ── DDL (all idempotent: IF NOT EXISTS, DROP TRIGGER IF EXISTS) ────────────
  await db.unsafe(`
    CREATE OR REPLACE FUNCTION public.update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    DO $$ BEGIN
      CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'urgent');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$;

    CREATE TABLE IF NOT EXISTS public.areas (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name        TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    DROP TRIGGER IF EXISTS trg_areas_updated_at ON public.areas;
    CREATE TRIGGER trg_areas_updated_at
      BEFORE UPDATE ON public.areas
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    CREATE TABLE IF NOT EXISTS public.profiles (
      id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name   TEXT,
      email       TEXT NOT NULL UNIQUE,
      avatar_url    TEXT,
      password_hash TEXT,
      area_id     UUID REFERENCES public.areas(id) ON DELETE SET NULL,
      created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
    CREATE INDEX IF NOT EXISTS idx_profiles_area  ON public.profiles(area_id);
    ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS password_hash TEXT;
    DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
    CREATE TRIGGER trg_profiles_updated_at
      BEFORE UPDATE ON public.profiles
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    CREATE TABLE IF NOT EXISTS public.user_roles_smart_path (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      role       TEXT NOT NULL,
      area_id    UUID REFERENCES public.areas(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id, role)
    );
    CREATE INDEX IF NOT EXISTS idx_user_roles_user ON public.user_roles_smart_path(user_id);
    CREATE INDEX IF NOT EXISTS idx_user_roles_area ON public.user_roles_smart_path(area_id);

    CREATE TABLE IF NOT EXISTS public.role_permissions (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      role       TEXT NOT NULL,
      permission TEXT NOT NULL,
      enabled    BOOLEAN NOT NULL DEFAULT true,
      UNIQUE (role, permission)
    );

    CREATE TABLE IF NOT EXISTS public.kanban_columns (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name         TEXT NOT NULL,
      position     INT  NOT NULL DEFAULT 0,
      color        TEXT NOT NULL DEFAULT '#D5D6D7',
      is_completed BOOLEAN NOT NULL DEFAULT false,
      area_id      UUID REFERENCES public.areas(id) ON DELETE SET NULL,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_kanban_columns_area ON public.kanban_columns(area_id);
    DROP TRIGGER IF EXISTS trg_kanban_columns_updated_at ON public.kanban_columns;
    CREATE TRIGGER trg_kanban_columns_updated_at
      BEFORE UPDATE ON public.kanban_columns
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    CREATE TABLE IF NOT EXISTS public.requests (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title            TEXT NOT NULL,
      description      TEXT,
      objective        TEXT,
      process          TEXT,
      status_column_id UUID REFERENCES public.kanban_columns(id) ON DELETE SET NULL,
      priority         TEXT NOT NULL DEFAULT 'medium',
      created_by       UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      assigned_to      UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
      custom_data      JSONB NOT NULL DEFAULT '{}'::jsonb,
      position         INT  NOT NULL DEFAULT 0,
      area_id          UUID REFERENCES public.areas(id) ON DELETE SET NULL,
      expires_at       TIMESTAMPTZ,
      completed_at     TIMESTAMPTZ,
      created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
    CREATE INDEX IF NOT EXISTS idx_requests_status       ON public.requests(status_column_id);
    CREATE INDEX IF NOT EXISTS idx_requests_created_by   ON public.requests(created_by);
    CREATE INDEX IF NOT EXISTS idx_requests_area         ON public.requests(area_id);
    CREATE INDEX IF NOT EXISTS idx_requests_expires_at   ON public.requests(expires_at);
    CREATE INDEX IF NOT EXISTS idx_requests_completed_at ON public.requests(completed_at);
    ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS parent_request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_requests_parent ON public.requests(parent_request_id);
    DROP TRIGGER IF EXISTS trg_requests_updated_at ON public.requests;
    CREATE TRIGGER trg_requests_updated_at
      BEFORE UPDATE ON public.requests
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    CREATE TABLE IF NOT EXISTS public.comments (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
      user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      content    TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_comments_request ON public.comments(request_id);
    DROP TRIGGER IF EXISTS trg_comments_updated_at ON public.comments;
    CREATE TRIGGER trg_comments_updated_at
      BEFORE UPDATE ON public.comments
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    CREATE TABLE IF NOT EXISTS public.chat_conversations (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
      title      TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_conversations_user ON public.chat_conversations(user_id);
    DROP TRIGGER IF EXISTS trg_chat_conv_updated_at ON public.chat_conversations;
    CREATE TRIGGER trg_chat_conv_updated_at
      BEFORE UPDATE ON public.chat_conversations
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

    CREATE TABLE IF NOT EXISTS public.chat_messages (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL,
      content         TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at);

    CREATE TABLE IF NOT EXISTS public.notifications (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      type       TEXT NOT NULL,
      title      TEXT NOT NULL,
      body       TEXT,
      data       JSONB DEFAULT '{}',
      read       BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user      ON public.notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON public.notifications(user_id, read);

    CREATE TABLE IF NOT EXISTS public.sessions (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_sessions_user    ON public.sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON public.sessions(expires_at);

    CREATE TABLE IF NOT EXISTS public.ai_settings (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      system_prompt    TEXT NOT NULL,
      intake_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
      model            TEXT NOT NULL DEFAULT 'gpt-4o-mini',
      is_active        BOOLEAN NOT NULL DEFAULT true,
      area_id          UUID REFERENCES public.areas(id) ON DELETE SET NULL,
      updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    DROP TRIGGER IF EXISTS trg_ai_settings_updated_at ON public.ai_settings;
    CREATE TRIGGER trg_ai_settings_updated_at
      BEFORE UPDATE ON public.ai_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  `);

  // ── Seeds (idempotent via ON CONFLICT) ─────────────────────────────────────

  // Areas — idempotent (UNIQUE on name)
  await db`
    INSERT INTO public.areas (name, description)
    VALUES ('Área General', 'Área por defecto')
    ON CONFLICT (name) DO NOTHING
  `;

  // Role permissions — idempotent (UNIQUE on role, permission)
  await db`
    INSERT INTO public.role_permissions (role, permission, enabled) VALUES
      ('super_admin','view_dashboard',true),('super_admin','view_board',true),('super_admin','view_team',true),
      ('super_admin','create_requests',true),('super_admin','edit_own_requests',true),
      ('super_admin','edit_all_requests',true),('super_admin','delete_own_requests',true),
      ('super_admin','delete_all_requests',true),('super_admin','view_all_requests',true),
      ('super_admin','assign_requests',true),('super_admin','manage_users',true),
      ('super_admin','manage_roles',true),('super_admin','manage_permissions',true),
      ('super_admin','manage_areas',true),('super_admin','view_analytics',true),
      ('super_admin','export_data',true),('super_admin','use_ai_features',true),
      ('super_admin','manage_settings',true),('super_admin','manage_request_expiration',true),
      ('area_admin','view_dashboard',true),('area_admin','view_board',true),('area_admin','view_team',true),
      ('area_admin','create_requests',true),('area_admin','edit_own_requests',true),
      ('area_admin','edit_all_requests',true),('area_admin','delete_own_requests',true),
      ('area_admin','delete_all_requests',true),('area_admin','view_all_requests',true),
      ('area_admin','assign_requests',true),('area_admin','manage_users',true),
      ('area_admin','manage_roles',true),('area_admin','view_analytics',true),
      ('area_admin','export_data',true),('area_admin','use_ai_features',true),
      ('area_admin','manage_request_expiration',true),
      ('manager','view_dashboard',true),('manager','view_board',true),('manager','view_team',true),
      ('manager','create_requests',true),('manager','edit_own_requests',true),
      ('manager','edit_all_requests',true),('manager','delete_own_requests',true),
      ('manager','delete_all_requests',true),('manager','view_all_requests',true),
      ('manager','assign_requests',true),('manager','view_analytics',true),
      ('manager','export_data',true),('manager','use_ai_features',true),
      ('manager','manage_request_expiration',true),
      ('client','view_dashboard',true),('client','view_board',true),
      ('client','create_requests',true),('client','edit_own_requests',true),
      ('client','delete_own_requests',true),('client','use_ai_features',true),
      ('viewer','view_dashboard',true),('viewer','view_board',true),('viewer','view_all_requests',true)
    ON CONFLICT (role, permission) DO NOTHING
  `;

  // Kanban columns — only seed if table is empty (no unique key on name/position)
  const [{ count: colCount }] = await db<[{ count: string }]>`
    SELECT COUNT(*)::text AS count FROM public.kanban_columns
  `;
  if (Number(colCount) === 0) {
    await db`
      INSERT INTO public.kanban_columns (name, position, color, is_completed) VALUES
        ('Nuevo',       0, '#D5D6D7', false),
        ('En Análisis', 1, '#F1F1F1', false),
        ('En Curso',    2, '#ED5650', false),
        ('En Revisión', 3, '#333333', false),
        ('Completado',  4, '#22c55e', true)
    `;
  }

  // AI settings — only seed if table is empty
  const [{ count: aiCount }] = await db<[{ count: string }]>`
    SELECT COUNT(*)::text AS count FROM public.ai_settings
  `;
  if (Number(aiCount) === 0) {
    await db`
      INSERT INTO public.ai_settings (system_prompt, intake_questions, model) VALUES (
        'Eres un asistente experto en gestión de proyectos. Tu rol es ayudar al cliente a estructurar una nueva solicitud de proyecto. Haz preguntas claras y específicas, una a la vez, para entender: 1) el objetivo del proyecto, 2) los procesos o pasos involucrados, 3) los detalles técnicos relevantes, 4) las restricciones o requisitos especiales. Sé empático, claro y profesional. Cuando hayas recopilado información suficiente (objetivo, descripción detallada y proceso), llama a la función create_request para registrar la solicitud. No crees la solicitud antes de tener al menos: título, objetivo y descripción.',
        '["¿Cuál es el objetivo principal de este proyecto?", "¿Qué procesos o pasos están involucrados?", "¿Hay restricciones de tiempo o recursos?", "¿Quién es el público o usuario final?", "¿Qué consideras un resultado exitoso?"]'::jsonb,
        'gpt-4o-mini'
      )
    `;
  }

  console.log("[migrate] Migrations complete.");
}

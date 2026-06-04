
-- ============ ENUMS (idempotent via DO block) ============
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role_2') THEN
    CREATE TYPE public.app_role_2 AS ENUM ('admin', 'manager', 'client', 'viewer');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'priority_level') THEN
    CREATE TYPE public.priority_level AS ENUM ('low', 'medium', 'high', 'urgent');
  END IF;
END $$;

-- ============ updated_at function ============
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ PROFILES ============
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id);
DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ USER ROLES ============
CREATE TABLE IF NOT EXISTS public.user_roles_smart_path (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role_2 NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles_smart_path TO authenticated;
GRANT ALL ON public.user_roles_smart_path TO service_role;
ALTER TABLE public.user_roles_smart_path ENABLE ROW LEVEL SECURITY;

-- Drop only our app_role_2 overload before recreating (leaves app_role version intact)
DROP FUNCTION IF EXISTS public.has_role(UUID, app_role_2) CASCADE;

-- Security definer to avoid recursive RLS
-- Cast both sides to text so this works regardless of whether the column type is app_role or app_role_2
CREATE FUNCTION public.has_role(_user_id UUID, _role app_role_2)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles_smart_path WHERE user_id = _user_id AND role::text = _role::text)
$$;

-- Explicit cast on all policy calls so PostgreSQL always picks the app_role_2 overload
DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles_smart_path;
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles_smart_path
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role_2));
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles_smart_path;
CREATE POLICY "user_roles_admin_all" ON public.user_roles_smart_path
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role_2))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role_2));

-- ============ NEW USER TRIGGER ============
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles_smart_path) INTO is_first_user;
  IF is_first_user THEN
    INSERT INTO public.user_roles_smart_path (user_id, role) VALUES (NEW.id, 'admin'::app_role_2) ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO public.user_roles_smart_path (user_id, role) VALUES (NEW.id, 'client'::app_role_2) ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ KANBAN COLUMNS ============
CREATE TABLE IF NOT EXISTS public.kanban_columns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  position INT NOT NULL DEFAULT 0,
  color TEXT NOT NULL DEFAULT '#D5D6D7',
  is_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.kanban_columns TO authenticated;
GRANT ALL ON public.kanban_columns TO service_role;
ALTER TABLE public.kanban_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_columns_select_all" ON public.kanban_columns;
CREATE POLICY "kanban_columns_select_all" ON public.kanban_columns
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "kanban_columns_admin_all" ON public.kanban_columns;
CREATE POLICY "kanban_columns_admin_all" ON public.kanban_columns
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role_2))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role_2));

DROP TRIGGER IF EXISTS trg_kanban_columns_updated_at ON public.kanban_columns;
CREATE TRIGGER trg_kanban_columns_updated_at
  BEFORE UPDATE ON public.kanban_columns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CUSTOM FIELDS ============
CREATE TABLE IF NOT EXISTS public.custom_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  field_key TEXT NOT NULL UNIQUE,
  field_type TEXT NOT NULL DEFAULT 'text',
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  required BOOLEAN NOT NULL DEFAULT false,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.custom_fields TO authenticated;
GRANT ALL ON public.custom_fields TO service_role;
ALTER TABLE public.custom_fields ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "custom_fields_select_all" ON public.custom_fields;
CREATE POLICY "custom_fields_select_all" ON public.custom_fields
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "custom_fields_admin_all" ON public.custom_fields;
CREATE POLICY "custom_fields_admin_all" ON public.custom_fields
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role_2))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role_2));

-- ============ REQUESTS ============
CREATE TABLE IF NOT EXISTS public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  objective TEXT,
  process TEXT,
  status_column_id UUID REFERENCES public.kanban_columns(id) ON DELETE SET NULL,
  priority priority_level NOT NULL DEFAULT 'medium',
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assigned_to UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  custom_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  position INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.requests TO authenticated;
GRANT ALL ON public.requests TO service_role;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "requests_select" ON public.requests;
CREATE POLICY "requests_select" ON public.requests
  FOR SELECT TO authenticated
  USING (
    created_by = auth.uid()
    OR assigned_to = auth.uid()
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
    OR public.has_role(auth.uid(), 'manager'::app_role_2)
    OR public.has_role(auth.uid(), 'viewer'::app_role_2)
  );
DROP POLICY IF EXISTS "requests_insert" ON public.requests;
CREATE POLICY "requests_insert" ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND NOT public.has_role(auth.uid(), 'viewer'::app_role_2)
  );
DROP POLICY IF EXISTS "requests_update" ON public.requests;
CREATE POLICY "requests_update" ON public.requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role_2)
    OR public.has_role(auth.uid(), 'manager'::app_role_2)
    OR (created_by = auth.uid() AND public.has_role(auth.uid(), 'client'::app_role_2))
  );
DROP POLICY IF EXISTS "requests_delete" ON public.requests;
CREATE POLICY "requests_delete" ON public.requests
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role_2) OR public.has_role(auth.uid(), 'manager'::app_role_2));

DROP TRIGGER IF EXISTS trg_requests_updated_at ON public.requests;
CREATE TRIGGER trg_requests_updated_at
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_requests_status ON public.requests(status_column_id);
CREATE INDEX IF NOT EXISTS idx_requests_created_by ON public.requests(created_by);

-- ============ CHAT CONVERSATIONS ============
CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL,
  title TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_conversations TO authenticated;
GRANT ALL ON public.chat_conversations TO service_role;
ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_conv_select" ON public.chat_conversations;
CREATE POLICY "chat_conv_select" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role_2) OR public.has_role(auth.uid(), 'manager'::app_role_2));
DROP POLICY IF EXISTS "chat_conv_insert" ON public.chat_conversations;
CREATE POLICY "chat_conv_insert" ON public.chat_conversations
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "chat_conv_update_own" ON public.chat_conversations;
CREATE POLICY "chat_conv_update_own" ON public.chat_conversations
  FOR UPDATE TO authenticated USING (user_id = auth.uid());
DROP POLICY IF EXISTS "chat_conv_delete_own" ON public.chat_conversations;
CREATE POLICY "chat_conv_delete_own" ON public.chat_conversations
  FOR DELETE TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role_2));

DROP TRIGGER IF EXISTS trg_chat_conv_updated_at ON public.chat_conversations;
CREATE TRIGGER trg_chat_conv_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ CHAT MESSAGES ============
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_msg_select" ON public.chat_messages;
CREATE POLICY "chat_msg_select" ON public.chat_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id
        AND (c.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role_2) OR public.has_role(auth.uid(), 'manager'::app_role_2))
    )
  );
DROP POLICY IF EXISTS "chat_msg_insert" ON public.chat_messages;
CREATE POLICY "chat_msg_insert" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS idx_chat_messages_conv ON public.chat_messages(conversation_id, created_at);

-- ============ AI SETTINGS ============
CREATE TABLE IF NOT EXISTS public.ai_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt TEXT NOT NULL,
  intake_questions JSONB NOT NULL DEFAULT '[]'::jsonb,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  is_active BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ai_settings TO authenticated;
GRANT ALL ON public.ai_settings TO service_role;
ALTER TABLE public.ai_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_settings_select_all" ON public.ai_settings;
CREATE POLICY "ai_settings_select_all" ON public.ai_settings
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "ai_settings_admin_all" ON public.ai_settings;
CREATE POLICY "ai_settings_admin_all" ON public.ai_settings
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role_2))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role_2));

DROP TRIGGER IF EXISTS trg_ai_settings_updated_at ON public.ai_settings;
CREATE TRIGGER trg_ai_settings_updated_at
  BEFORE UPDATE ON public.ai_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ SEEDS (skip if already exist) ============
INSERT INTO public.kanban_columns (name, position, color, is_completed) VALUES
  ('Nuevo', 0, '#D5D6D7', false),
  ('En Análisis', 1, '#F1F1F1', false),
  ('En Curso', 2, '#ED5650', false),
  ('En Revisión', 3, '#333333', false),
  ('Completado', 4, '#22c55e', true)
ON CONFLICT DO NOTHING;

INSERT INTO public.ai_settings (system_prompt, intake_questions, model) VALUES (
  'Eres un asistente experto en gestión de proyectos. Tu rol es ayudar al cliente a estructurar una nueva solicitud de proyecto. Haz preguntas claras y específicas, una a la vez, para entender: 1) el objetivo del proyecto, 2) los procesos o pasos involucrados, 3) los detalles técnicos relevantes, 4) las restricciones o requisitos especiales. Sé empático, claro y profesional. Cuando hayas recopilado información suficiente (objetivo, descripción detallada y proceso), llama a la función create_request para registrar la solicitud. No crees la solicitud antes de tener al menos: título, objetivo y descripción.',
  '["¿Cuál es el objetivo principal de este proyecto?", "¿Qué procesos o pasos están involucrados?", "¿Hay restricciones de tiempo o recursos?", "¿Quién es el público o usuario final?", "¿Qué consideras un resultado exitoso?"]'::jsonb,
  'gpt-4o-mini'
) ON CONFLICT DO NOTHING;

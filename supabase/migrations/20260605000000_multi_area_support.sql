-- Multi-Area Support Migration
-- This migration adds support for multiple areas with independent administration

-- ============ CREATE AREAS TABLE ============
CREATE TABLE IF NOT EXISTS public.areas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.areas TO authenticated;
GRANT ALL ON public.areas TO service_role;
ALTER TABLE public.areas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "areas_select_all" ON public.areas;
CREATE POLICY "areas_select_all" ON public.areas
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "areas_admin_all" ON public.areas;
CREATE POLICY "areas_admin_all" ON public.areas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role_2))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role_2));

DROP TRIGGER IF EXISTS trg_areas_updated_at ON public.areas;
CREATE TRIGGER trg_areas_updated_at
  BEFORE UPDATE ON public.areas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ UPDATE ROLE ENUM ============
-- Add new roles: super_admin and area_admin
-- Note: We need to recreate the enum type since PostgreSQL doesn't support adding values to enums
-- We'll keep the existing enum and handle the logic in the application layer for now
-- The existing 'admin' role will function as 'super_admin' with global access
-- We'll add 'area_admin' as a new role value by creating a new enum type

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role_3') THEN
    CREATE TYPE public.app_role_3 AS ENUM ('super_admin', 'area_admin', 'manager', 'client', 'viewer');
  END IF;
END $$;

-- ============ ADD AREA_ID TO EXISTING TABLES ============

-- Add area_id to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_area ON public.profiles(area_id);

-- Add area_id to requests
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_requests_area ON public.requests(area_id);

-- Add area_id to kanban_columns
ALTER TABLE public.kanban_columns ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_kanban_columns_area ON public.kanban_columns(area_id);

-- Add area_id to custom_fields
ALTER TABLE public.custom_fields ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_custom_fields_area ON public.custom_fields(area_id);

-- Add area_id to ai_settings
ALTER TABLE public.ai_settings ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_ai_settings_area ON public.ai_settings(area_id);

-- Add area_id to user_roles_smart_path
ALTER TABLE public.user_roles_smart_path ADD COLUMN IF NOT EXISTS area_id UUID REFERENCES public.areas(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_user_roles_area ON public.user_roles_smart_path(area_id);

-- ============ CREATE HELPER FUNCTIONS ============

-- Function to get user's area
CREATE OR REPLACE FUNCTION public.get_user_area(_user_id UUID)
RETURNS UUID
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT area_id FROM public.profiles WHERE id = _user_id;
$$;

-- Function to check if user is area admin for a specific area
CREATE OR REPLACE FUNCTION public.is_area_admin(_user_id UUID, _area_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles_smart_path 
    WHERE user_id = _user_id 
      AND role::text = 'area_admin'
      AND area_id = _area_id
  );
$$;

-- Function to check if user is super admin (current admin role)
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles_smart_path 
    WHERE user_id = _user_id 
      AND role::text = 'admin'
  );
$$;

-- ============ MIGRATE EXISTING DATA ============
-- Create a default area for existing data
INSERT INTO public.areas (name, description) 
VALUES ('Área General', 'Área por defecto para datos existentes')
ON CONFLICT (name) DO NOTHING;

-- Assign default area to existing profiles
UPDATE public.profiles 
SET area_id = (SELECT id FROM public.areas WHERE name = 'Área General')
WHERE area_id IS NULL;

-- Assign default area to existing requests
UPDATE public.requests 
SET area_id = (SELECT id FROM public.areas WHERE name = 'Área General')
WHERE area_id IS NULL;

-- Assign default area to existing kanban_columns
UPDATE public.kanban_columns 
SET area_id = (SELECT id FROM public.areas WHERE name = 'Área General')
WHERE area_id IS NULL;

-- Assign default area to existing custom_fields
UPDATE public.custom_fields 
SET area_id = (SELECT id FROM public.areas WHERE name = 'Área General')
WHERE area_id IS NULL;

-- Assign default area to existing ai_settings
UPDATE public.ai_settings 
SET area_id = (SELECT id FROM public.areas WHERE name = 'Área General')
WHERE area_id IS NULL;

-- Assign default area to existing user_roles
UPDATE public.user_roles_smart_path 
SET area_id = (SELECT id FROM public.areas WHERE name = 'Área General')
WHERE area_id IS NULL;

-- ============ UPDATE RLS POLICIES FOR AREA ISOLATION ============

-- Update profiles policy
DROP POLICY IF EXISTS "profiles_select_authenticated" ON public.profiles;
CREATE POLICY "profiles_select_authenticated" ON public.profiles
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()
    OR area_id = public.get_user_area(auth.uid())
    OR public.is_super_admin(auth.uid())
  );

-- Update requests policies
DROP POLICY IF EXISTS "requests_select" ON public.requests;
CREATE POLICY "requests_select" ON public.requests
  FOR SELECT TO authenticated
  USING (
    area_id = public.get_user_area(auth.uid())
    OR created_by = auth.uid()
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
    AND area_id = public.get_user_area(auth.uid())
    AND NOT public.has_role(auth.uid(), 'viewer'::app_role_2)
  );

DROP POLICY IF EXISTS "requests_update" ON public.requests;
CREATE POLICY "requests_update" ON public.requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role_2)
    OR (area_id = public.get_user_area(auth.uid()) AND public.has_role(auth.uid(), 'manager'::app_role_2))
    OR (created_by = auth.uid() AND area_id = public.get_user_area(auth.uid()) AND public.has_role(auth.uid(), 'client'::app_role_2))
  );

DROP POLICY IF EXISTS "requests_delete" ON public.requests;
CREATE POLICY "requests_delete" ON public.requests
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role_2)
    OR (area_id = public.get_user_area(auth.uid()) AND public.has_role(auth.uid(), 'manager'::app_role_2))
  );

-- Update kanban_columns policies
DROP POLICY IF EXISTS "kanban_columns_select_all" ON public.kanban_columns;
CREATE POLICY "kanban_columns_select_all" ON public.kanban_columns
  FOR SELECT TO authenticated
  USING (
    area_id = public.get_user_area(auth.uid())
    OR area_id IS NULL
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

DROP POLICY IF EXISTS "kanban_columns_admin_all" ON public.kanban_columns;
CREATE POLICY "kanban_columns_admin_all" ON public.kanban_columns
  FOR ALL TO authenticated
  USING (
    area_id = public.get_user_area(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  )
  WITH CHECK (
    area_id = public.get_user_area(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

-- Update custom_fields policies
DROP POLICY IF EXISTS "custom_fields_select_all" ON public.custom_fields;
CREATE POLICY "custom_fields_select_all" ON public.custom_fields
  FOR SELECT TO authenticated
  USING (
    area_id = public.get_user_area(auth.uid())
    OR area_id IS NULL
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

DROP POLICY IF EXISTS "custom_fields_admin_all" ON public.custom_fields;
CREATE POLICY "custom_fields_admin_all" ON public.custom_fields
  FOR ALL TO authenticated
  USING (
    area_id = public.get_user_area(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  )
  WITH CHECK (
    area_id = public.get_user_area(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

-- Update ai_settings policies
DROP POLICY IF EXISTS "ai_settings_select_all" ON public.ai_settings;
CREATE POLICY "ai_settings_select_all" ON public.ai_settings
  FOR SELECT TO authenticated
  USING (
    area_id = public.get_user_area(auth.uid())
    OR area_id IS NULL
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

DROP POLICY IF EXISTS "ai_settings_admin_all" ON public.ai_settings;
CREATE POLICY "ai_settings_admin_all" ON public.ai_settings
  FOR ALL TO authenticated
  USING (
    area_id = public.get_user_area(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  )
  WITH CHECK (
    area_id = public.get_user_area(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

-- Update user_roles policies
DROP POLICY IF EXISTS "user_roles_select_own_or_admin" ON public.user_roles_smart_path;
CREATE POLICY "user_roles_select_own_or_admin" ON public.user_roles_smart_path
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR area_id = public.get_user_area(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles_smart_path;
CREATE POLICY "user_roles_admin_all" ON public.user_roles_smart_path
  FOR ALL TO authenticated
  USING (
    area_id = public.get_user_area(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  )
  WITH CHECK (
    area_id = public.get_user_area(auth.uid())
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

-- Update chat_conversations policies
DROP POLICY IF EXISTS "chat_conv_select" ON public.chat_conversations;
CREATE POLICY "chat_conv_select" ON public.chat_conversations
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = chat_conversations.request_id
        AND r.area_id = public.get_user_area(auth.uid())
    )
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
    OR public.has_role(auth.uid(), 'manager'::app_role_2)
  );

-- Add comments for documentation
COMMENT ON TABLE public.areas IS 'Stores organizational areas for multi-tenant support. Each area can have its own administrators, settings, and isolated data.';
COMMENT ON COLUMN public.profiles.area_id IS 'The area this user belongs to. NULL for super admins who have access to all areas.';
COMMENT ON COLUMN public.requests.area_id IS 'The area this request belongs to. Used for data isolation between areas.';
COMMENT ON COLUMN public.user_roles_smart_path.area_id IS 'The area this role assignment applies to. NULL for global roles like super_admin.';

-- Fix RLS policies for kanban_columns, areas, custom_fields, and ai_settings
-- These tables had policies that checked for 'admin' role, but after migration 003
-- existing admin users were converted to 'super_admin', leaving no users with 'admin' role.
-- Also add missing INSERT/UPDATE/DELETE grants to authenticated role.

-- ============ KANBAN COLUMNS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kanban_columns TO authenticated;

DROP POLICY IF EXISTS "kanban_columns_admin_all" ON public.kanban_columns;
CREATE POLICY "kanban_columns_admin_all" ON public.kanban_columns
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

-- ============ AREAS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.areas TO authenticated;

DROP POLICY IF EXISTS "areas_admin_all" ON public.areas;
CREATE POLICY "areas_admin_all" ON public.areas
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

-- ============ CUSTOM FIELDS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.custom_fields TO authenticated;

DROP POLICY IF EXISTS "custom_fields_admin_all" ON public.custom_fields;
CREATE POLICY "custom_fields_admin_all" ON public.custom_fields
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

-- ============ AI SETTINGS ============
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_settings TO authenticated;

DROP POLICY IF EXISTS "ai_settings_admin_all" ON public.ai_settings;
CREATE POLICY "ai_settings_admin_all" ON public.ai_settings
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

-- ============ USER ROLES (allow super_admin to manage) ============
DROP POLICY IF EXISTS "user_roles_admin_all" ON public.user_roles_smart_path;
CREATE POLICY "user_roles_admin_all" ON public.user_roles_smart_path
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
  );

GRANT INSERT, UPDATE, DELETE ON public.user_roles_smart_path TO authenticated;

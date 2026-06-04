-- Create role_permissions table to store permission configurations for each role
-- This allows admins to configure what each role can do

-- Create enum for available permissions
CREATE TYPE app_permission AS ENUM (
  'create_requests',
  'edit_own_requests',
  'edit_all_requests',
  'delete_own_requests',
  'delete_all_requests',
  'view_all_requests',
  'assign_requests',
  'manage_users',
  'manage_roles',
  'manage_permissions',
  'view_analytics',
  'export_data',
  'use_ai_features',
  'manage_settings'
);

-- Create role_permissions table
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  role app_role_2 NOT NULL,
  permission app_permission NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, permission)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Only admins can manage role permissions
CREATE POLICY "role_permissions_select" ON public.role_permissions
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role_2));

CREATE POLICY "role_permissions_insert" ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role_2)
  );

CREATE POLICY "role_permissions_update" ON public.role_permissions
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role_2)
  );

CREATE POLICY "role_permissions_delete" ON public.role_permissions
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role_2)
  );

-- Function to check if a role has a specific permission
CREATE OR REPLACE FUNCTION public.role_has_permission(_role app_role_2, _permission app_permission)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.role_permissions WHERE role = _role AND permission = _permission),
    false
  );
$$;

-- Function to check if a user has a specific permission (through their roles)
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id UUID, _permission app_permission)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles_smart_path ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    WHERE ur.user_id = _user_id 
      AND rp.permission = _permission 
      AND rp.enabled = true
  );
$$;

-- Insert default permissions for each role
-- Admin: All permissions
INSERT INTO public.role_permissions (role, permission, enabled)
SELECT 'admin'::app_role_2, unnest(ARRAY[
  'create_requests'::app_permission,
  'edit_own_requests',
  'edit_all_requests',
  'delete_own_requests',
  'delete_all_requests',
  'view_all_requests',
  'assign_requests',
  'manage_users',
  'manage_roles',
  'manage_permissions',
  'view_analytics',
  'export_data',
  'use_ai_features',
  'manage_settings'
]), true
ON CONFLICT (role, permission) DO NOTHING;

-- Manager: Most permissions except user/role/permission management
INSERT INTO public.role_permissions (role, permission, enabled)
SELECT 'manager'::app_role_2, unnest(ARRAY[
  'create_requests'::app_permission,
  'edit_own_requests',
  'edit_all_requests',
  'delete_own_requests',
  'delete_all_requests',
  'view_all_requests',
  'assign_requests',
  'view_analytics',
  'export_data',
  'use_ai_features'
]), true
ON CONFLICT (role, permission) DO NOTHING;

-- Client: Basic request permissions
INSERT INTO public.role_permissions (role, permission, enabled)
SELECT 'client'::app_role_2, unnest(ARRAY[
  'create_requests'::app_permission,
  'edit_own_requests',
  'delete_own_requests',
  'use_ai_features'
]), true
ON CONFLICT (role, permission) DO NOTHING;

-- Viewer: Read-only permissions
INSERT INTO public.role_permissions (role, permission, enabled)
SELECT 'viewer'::app_role_2, unnest(ARRAY[
  'view_all_requests'::app_permission
]), true
ON CONFLICT (role, permission) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE public.role_permissions IS 'Stores permission configurations for each role. Admins can modify these to control what each role can do.';
COMMENT ON COLUMN public.role_permissions.role IS 'The role this permission applies to (admin, manager, client, viewer)';
COMMENT ON COLUMN public.role_permissions.permission IS 'The specific permission being granted/revoked';
COMMENT ON COLUMN public.role_permissions.enabled IS 'Whether this permission is enabled for the role';

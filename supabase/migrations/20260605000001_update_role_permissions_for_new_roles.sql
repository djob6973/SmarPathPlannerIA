-- Update role_permissions table to support new roles (super_admin, area_admin)
-- This migration updates the existing role_permissions to work with the new role structure

-- First, update the existing 'admin' role permissions to 'super_admin'
UPDATE public.role_permissions 
SET role = 'super_admin'::app_role_2 
WHERE role = 'admin'::app_role_2;

-- Insert permissions for the new area_admin role
-- Area admins have similar permissions to managers but can manage users and roles within their area
INSERT INTO public.role_permissions (role, permission, enabled)
SELECT 'area_admin'::app_role_2, unnest(ARRAY[
  'create_requests'::app_permission,
  'edit_own_requests',
  'edit_all_requests',
  'delete_own_requests',
  'delete_all_requests',
  'view_all_requests',
  'assign_requests',
  'manage_users',
  'manage_roles',
  'view_analytics',
  'export_data',
  'use_ai_features',
  'manage_request_expiration'
]), true
ON CONFLICT (role, permission) DO NOTHING;

-- Update existing admin users to super_admin
UPDATE public.user_roles_smart_path 
SET role = 'super_admin'::app_role_2 
WHERE role = 'admin'::app_role_2;

-- Add comment for documentation
COMMENT ON TABLE public.role_permissions IS 'Stores permission configurations for each role. Super admins have global access, area admins have access within their assigned area.';

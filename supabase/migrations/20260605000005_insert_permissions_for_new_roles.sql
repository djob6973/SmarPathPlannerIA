-- Add default permissions for super_admin and area_admin roles
-- Execute this AFTER running 20260605000004_add_permissions_for_new_roles.sql

-- Insert permissions for super_admin
INSERT INTO role_permissions (role, permission, enabled)
VALUES
  ('super_admin', 'create_requests', true),
  ('super_admin', 'edit_own_requests', true),
  ('super_admin', 'edit_all_requests', true),
  ('super_admin', 'delete_own_requests', true),
  ('super_admin', 'delete_all_requests', true),
  ('super_admin', 'view_all_requests', true),
  ('super_admin', 'assign_requests', true),
  ('super_admin', 'manage_users', true),
  ('super_admin', 'manage_roles', true),
  ('super_admin', 'manage_permissions', true),
  ('super_admin', 'manage_areas', true),
  ('super_admin', 'view_analytics', true),
  ('super_admin', 'export_data', true),
  ('super_admin', 'use_ai_features', true),
  ('super_admin', 'manage_settings', true),
  ('super_admin', 'manage_request_expiration', true)
ON CONFLICT (role, permission) DO NOTHING;

-- Insert permissions for area_admin
INSERT INTO role_permissions (role, permission, enabled)
VALUES
  ('area_admin', 'create_requests', true),
  ('area_admin', 'edit_own_requests', true),
  ('area_admin', 'edit_all_requests', true),
  ('area_admin', 'delete_own_requests', true),
  ('area_admin', 'delete_all_requests', true),
  ('area_admin', 'view_all_requests', true),
  ('area_admin', 'assign_requests', true),
  ('area_admin', 'manage_users', true),
  ('area_admin', 'manage_roles', true),
  ('area_admin', 'view_analytics', true),
  ('area_admin', 'export_data', true),
  ('area_admin', 'use_ai_features', true),
  ('area_admin', 'manage_request_expiration', true)
ON CONFLICT (role, permission) DO NOTHING;

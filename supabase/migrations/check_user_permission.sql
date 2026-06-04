-- Consulta para verificar si el permiso está correctamente asignado
-- Ejecuta esto en el editor SQL de Supabase

-- 1. Verificar que el permiso existe en role_permissions
SELECT 
  role, 
  permission, 
  enabled,
  created_by,
  expires_at
FROM public.role_permissions 
WHERE permission = 'manage_request_expiration'::app_permission;

-- 2. Verificar tu rol actual (reemplaza <your_user_id> con tu UUID real)
-- SELECT role FROM public.user_roles_smart_path WHERE user_id = '<your_user_id>'::UUID;

-- 3. Verificar todos tus permisos (reemplaza <your_user_id> con tu UUID real)
-- SELECT DISTINCT rp.permission, rp.enabled
-- FROM public.user_roles_smart_path ur
-- JOIN public.role_permissions rp ON ur.role = rp.role
-- WHERE ur.user_id = '<your_user_id>'::UUID
--   AND rp.enabled = true
--   AND (rp.expires_at IS NULL OR rp.expires_at > NOW());

-- 4. Verificar si la función user_has_permission_by_name funciona
-- SELECT public.user_has_permission_by_name('<your_user_id>'::UUID, 'manage_request_expiration');

-- Corregir: Habilitar el permiso manage_request_expiration para admin y manager
-- Ejecuta esto en el editor SQL de Supabase

-- Primero eliminar las entradas incorrectas para client y viewer
DELETE FROM public.role_permissions 
WHERE permission = 'manage_request_expiration'::app_permission 
  AND role IN ('client', 'viewer');

-- Insertar el permiso para admin
INSERT INTO public.role_permissions (role, permission, enabled)
VALUES ('admin'::app_role_2, 'manage_request_expiration'::app_permission, true)
ON CONFLICT (role, permission) DO UPDATE SET enabled = true;

-- Insertar el permiso para manager
INSERT INTO public.role_permissions (role, permission, enabled)
VALUES ('manager'::app_role_2, 'manage_request_expiration'::app_permission, true)
ON CONFLICT (role, permission) DO UPDATE SET enabled = true;

-- Verificar el resultado
SELECT 
  role, 
  permission, 
  enabled,
  created_by,
  expires_at
FROM public.role_permissions 
WHERE permission = 'manage_request_expiration'::app_permission;

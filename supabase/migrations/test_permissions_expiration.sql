-- Script de prueba para verificar las funcionalidades de permisos y vencimiento
-- Ejecuta este script en el editor SQL de Supabase

-- ============================================
-- 1. Verificar que las columnas existen
-- ============================================

-- Verificar columna expires_at en requests
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'requests' 
  AND column_name = 'expires_at';

-- Verificar columna created_by en role_permissions
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'role_permissions' 
  AND column_name = 'created_by';

-- Verificar columna expires_at en role_permissions
SELECT 
  column_name, 
  data_type, 
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'role_permissions' 
  AND column_name = 'expires_at';

-- ============================================
-- 2. Verificar que el nuevo permiso existe en el enum
-- ============================================

SELECT enumlabel 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_permission')
  AND enumlabel = 'manage_request_expiration';

-- ============================================
-- 3. Verificar que los permisos se otorgaron correctamente
-- ============================================

SELECT 
  role, 
  permission, 
  enabled,
  created_by,
  expires_at
FROM public.role_permissions 
WHERE permission = 'manage_request_expiration'::app_permission;

-- ============================================
-- 4. Verificar que las funciones existen
-- ============================================

SELECT 
  routine_name, 
  routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_name IN (
    'user_has_permission_by_name',
    'get_request_creator_name',
    'get_permission_creator_name',
    'validate_request_expiration'
  );

-- ============================================
-- 5. Verificar que el trigger existe
-- ============================================

SELECT 
  trigger_name,
  event_manipulation,
  event_object_table
FROM information_schema.triggers 
WHERE trigger_name = 'validate_request_expiration_trigger';

-- ============================================
-- 6. Prueba de función: Obtener nombre del creador de una solicitud
-- ============================================

-- Primero obtenemos un ID de solicitud existente
SELECT id, title, created_by 
FROM public.requests 
LIMIT 1;

-- Luego probamos la función (reemplaza <request_id> con un ID real del resultado anterior)
-- SELECT public.get_request_creator_name('<request_id>'::UUID);

-- ============================================
-- 7. Prueba de función: Verificar permiso por nombre
-- ============================================

-- Prueba con tu user ID (reemplaza con tu UUID real)
-- SELECT public.user_has_permission_by_name('<your_user_id>'::UUID, 'manage_request_expiration');

-- ============================================
-- 8. Verificar índices creados
-- ============================================

SELECT 
  indexname, 
  tablename
FROM pg_indexes 
WHERE indexname LIKE '%expires_at%';

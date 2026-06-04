-- Depurar por qué get_request_creator_name devuelve "Desconocido"
-- Ejecuta esto en el editor SQL de Supabase

-- 1. Verificar el created_by de la solicitud
SELECT 
  id, 
  title, 
  created_by
FROM public.requests 
WHERE id = '4495d1ce-57b8-49fe-805a-f46eb2223162';

-- 2. Verificar si existe el usuario en auth.users
SELECT 
  id, 
  email, 
  raw_user_meta_data
FROM auth.users 
WHERE id = (SELECT created_by FROM public.requests WHERE id = '4495d1ce-57b8-49fe-805a-f46eb2223162');

-- 3. Verificar si existe el perfil en public.profiles
SELECT 
  id, 
  full_name, 
  email
FROM public.profiles 
WHERE id = (SELECT created_by FROM public.requests WHERE id = '4495d1ce-57b8-49fe-805a-f46eb2223162');

-- 4. Probar la función directamente
SELECT public.get_request_creator_name('4495d1ce-57b8-49fe-805a-f46eb2223162'::UUID);

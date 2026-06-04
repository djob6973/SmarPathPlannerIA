
-- has_role(app_role) — otro proyecto, puede existir o no
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'has_role'
               AND pg_get_function_arguments(p.oid) LIKE '%app_role%'
               AND pg_get_function_arguments(p.oid) NOT LIKE '%app_role_2%') THEN
    REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role) FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role) TO authenticated, service_role;
  END IF;
END $$;

-- has_role(app_role_2) — nuestro proyecto
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, app_role_2) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, app_role_2) TO authenticated, service_role;

-- handle_new_user — compartida, siempre existe
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- get_my_roles — solo si existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public' AND p.proname = 'get_my_roles') THEN
    REVOKE EXECUTE ON FUNCTION public.get_my_roles() FROM PUBLIC, anon;
    GRANT EXECUTE ON FUNCTION public.get_my_roles() TO authenticated, service_role;
  END IF;
END $$;

-- Add permission for managing request expiration dates
-- This must be in a separate migration after the enum value is added

-- Add new permission for managing request expiration dates
ALTER TYPE app_permission ADD VALUE IF NOT EXISTS 'manage_request_expiration';

-- Create a function to check if user has permission by string name
CREATE OR REPLACE FUNCTION public.user_has_permission_by_name(_user_id UUID, _permission_name TEXT)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles_smart_path ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    WHERE ur.user_id = _user_id 
      AND rp.permission::text = _permission_name
      AND rp.enabled = true
      AND (rp.expires_at IS NULL OR rp.expires_at > NOW())
  );
$$;

-- Grant the new permission to admin and manager roles using a DO block
DO $$
BEGIN
  -- Insert for admin
  INSERT INTO public.role_permissions (role, permission, enabled)
  VALUES ('admin'::app_role_2, 'manage_request_expiration'::app_permission, true)
  ON CONFLICT (role, permission) DO NOTHING;
  
  -- Insert for manager
  INSERT INTO public.role_permissions (role, permission, enabled)
  VALUES ('manager'::app_role_2, 'manage_request_expiration'::app_permission, true)
  ON CONFLICT (role, permission) DO NOTHING;
EXCEPTION WHEN OTHERS THEN
  -- If enum value doesn't exist yet, skip and try again later
  RAISE NOTICE 'Permission insertion deferred: %', SQLERRM;
END $$;

-- Update requests_update policy to allow basic updates
DROP POLICY IF EXISTS "requests_update" ON public.requests;

CREATE POLICY "requests_update" ON public.requests
  FOR UPDATE TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role_2)
    OR public.has_role(auth.uid(), 'manager'::app_role_2)
    OR (created_by = auth.uid() AND public.has_role(auth.uid(), 'client'::app_role_2))
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role_2)
    OR public.has_role(auth.uid(), 'manager'::app_role_2)
    OR (created_by = auth.uid() AND public.has_role(auth.uid(), 'client'::app_role_2))
  );

-- Create a trigger function to validate expires_at changes
CREATE OR REPLACE FUNCTION public.validate_request_expiration()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Check if expires_at is being changed to a non-null value
  IF NEW.expires_at IS NOT NULL AND (OLD.expires_at IS NULL OR OLD.expires_at IS DISTINCT FROM NEW.expires_at) THEN
    -- Only allow if user has manage_request_expiration permission
    IF NOT public.user_has_permission_by_name(auth.uid(), 'manage_request_expiration') THEN
      RAISE EXCEPTION 'No tienes permiso para establecer la fecha de vencimiento de solicitudes';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to validate expires_at on update
DROP TRIGGER IF EXISTS validate_request_expiration_trigger ON public.requests;
CREATE TRIGGER validate_request_expiration_trigger
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.validate_request_expiration();

-- Create a function to get request creator name for display
CREATE OR REPLACE FUNCTION public.get_request_creator_name(_request_id UUID)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'full_name' 
     FROM auth.users 
     WHERE id = (SELECT created_by FROM public.requests WHERE id = _request_id)),
    (SELECT email 
     FROM auth.users 
     WHERE id = (SELECT created_by FROM public.requests WHERE id = _request_id)),
    'Unknown'
  );
$$;

-- Create a function to check if a request is expired
CREATE OR REPLACE FUNCTION public.is_request_expired(_request_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT expires_at < NOW() FROM public.requests WHERE id = _request_id),
    false
  );
$$;

-- Add index on expires_at for performance
CREATE INDEX IF NOT EXISTS idx_requests_expires_at ON public.requests(expires_at);

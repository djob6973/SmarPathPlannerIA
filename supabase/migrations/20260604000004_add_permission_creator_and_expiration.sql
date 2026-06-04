-- Add creator name and expiration date to role_permissions table
-- This allows tracking who created each permission and setting expiration dates

-- Add created_by column to track who created the permission
ALTER TABLE public.role_permissions 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- Add expires_at column for configurable expiration date
ALTER TABLE public.role_permissions 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

-- Add comment for documentation
COMMENT ON COLUMN public.role_permissions.created_by IS 'User ID of the admin who created this permission assignment';
COMMENT ON COLUMN public.role_permissions.expires_at IS 'Optional expiration date for this permission. NULL means no expiration.';

-- Update the role_has_permission function to check expiration date
CREATE OR REPLACE FUNCTION public.role_has_permission(_role app_role_2, _permission app_permission)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT enabled FROM public.role_permissions 
     WHERE role = _role 
       AND permission = _permission 
       AND (expires_at IS NULL OR expires_at > NOW())),
    false
  );
$$;

-- Update the user_has_permission function to check expiration date
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
      AND (rp.expires_at IS NULL OR rp.expires_at > NOW())
  );
$$;

-- Update insert policy to automatically set created_by
DROP POLICY IF EXISTS "role_permissions_insert" ON public.role_permissions;

CREATE POLICY "role_permissions_insert" ON public.role_permissions
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::app_role_2)
    AND created_by = auth.uid()
  );

-- Add a trigger to automatically set created_by on insert
CREATE OR REPLACE FUNCTION public.set_role_permissions_created_by()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.created_by = auth.uid();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_role_permissions_insert ON public.role_permissions;
CREATE TRIGGER on_role_permissions_insert
  BEFORE INSERT ON public.role_permissions
  FOR EACH ROW EXECUTE FUNCTION public.set_role_permissions_created_by();

-- Create a function to get creator name for display
CREATE OR REPLACE FUNCTION public.get_permission_creator_name(_permission_id UUID)
RETURNS TEXT
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT raw_user_meta_data->>'full_name' 
     FROM auth.users 
     WHERE id = (SELECT created_by FROM public.role_permissions WHERE id = _permission_id)),
    (SELECT email 
     FROM auth.users 
     WHERE id = (SELECT created_by FROM public.role_permissions WHERE id = _permission_id)),
    'Unknown'
  );
$$;

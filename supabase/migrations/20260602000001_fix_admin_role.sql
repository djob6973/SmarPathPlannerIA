-- Ensure user 7cd69ee9-d6ff-458a-a9f6-4a85089a40bb has the admin role in user_roles_smart_path.
-- This is needed when a user was granted admin outside of the auto-provisioning trigger
-- (e.g. manually assigned, migrated, or the trigger ran before the first-user check passed).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE id = '7cd69ee9-d6ff-458a-a9f6-4a85089a40bb') THEN
    INSERT INTO public.user_roles_smart_path (user_id, role)
    VALUES ('7cd69ee9-d6ff-458a-a9f6-4a85089a40bb', 'admin'::app_role_2)
    ON CONFLICT (user_id, role) DO NOTHING;
  END IF;
END $$;

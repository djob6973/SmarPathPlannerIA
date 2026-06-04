-- Assign super_admin role to the current user
-- This script checks if the user has any role and assigns super_admin if needed

-- First, let's see what roles the user currently has
-- Replace YOUR_USER_ID with your actual user ID from auth.users

-- Check current roles
SELECT ur.user_id, ur.role, p.email 
FROM public.user_roles_smart_path ur
JOIN public.profiles p ON ur.user_id = p.id
ORDER BY p.email, ur.role;

-- If you need to assign super_admin to a specific user, run this:
-- Replace 'YOUR_USER_ID_HERE' with the actual UUID from auth.users

-- Delete any existing admin role (if it still exists)
DELETE FROM public.user_roles_smart_path 
WHERE user_id = 'YOUR_USER_ID_HERE'::uuid AND role = 'admin'::app_role_2;

-- Assign super_admin role
INSERT INTO public.user_roles_smart_path (user_id, role)
VALUES ('YOUR_USER_ID_HERE'::uuid, 'super_admin'::app_role_2)
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the assignment
SELECT ur.user_id, ur.role, p.email 
FROM public.user_roles_smart_path ur
JOIN public.profiles p ON ur.user_id = p.id
WHERE ur.user_id = 'YOUR_USER_ID_HERE'::uuid;

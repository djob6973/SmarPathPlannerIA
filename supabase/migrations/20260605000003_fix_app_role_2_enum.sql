-- Fix app_role_2 enum to include super_admin and area_admin
-- Execute each step separately to avoid transaction issues

-- ===== STEP 1: Add super_admin value to app_role_2 =====
-- Execute this first, then commit, then execute step 2
ALTER TYPE public.app_role_2 ADD VALUE 'super_admin' BEFORE 'manager';

-- ===== STEP 2: Add area_admin value to app_role_2 =====  
-- Execute this after step 1 is committed
ALTER TYPE public.app_role_2 ADD VALUE 'area_admin' BEFORE 'manager';

-- ===== STEP 3: Convert existing 'admin' users to 'super_admin' =====
-- Execute this after steps 1 and 2 are committed
UPDATE public.user_roles_smart_path 
SET role = 'super_admin'::app_role_2 
WHERE role = 'admin'::app_role_2;

-- ===== STEP 4: Convert existing 'admin' permissions to 'super_admin' =====
-- Execute this after step 3
UPDATE public.role_permissions 
SET role = 'super_admin'::app_role_2 
WHERE role = 'admin'::app_role_2;

-- ===== STEP 5: Verify the changes =====
-- Execute this to verify everything worked
SELECT ur.user_id, ur.role::text, p.email 
FROM public.user_roles_smart_path ur
JOIN public.profiles p ON ur.user_id = p.id
ORDER BY p.email;

-- Update RLS policies for requests table to support multi-area system
-- This allows users to create requests with their assigned area_id

-- Update requests_insert policy to allow area_id
DROP POLICY IF EXISTS "requests_insert" ON public.requests;
CREATE POLICY "requests_insert" ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND NOT public.has_role(auth.uid(), 'viewer'::app_role_2)
    AND (
      -- Allow super_admin to set any area_id or null
      public.has_role(auth.uid(), 'super_admin'::app_role_2)
      OR
      -- Allow area_admin to set any area_id or null
      public.has_role(auth.uid(), 'area_admin'::app_role_2)
      OR
      -- Allow regular users to set their own area_id or null
      (
        area_id IS NULL
        OR area_id = (SELECT area_id FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

-- Update requests_select policy to respect area filtering
DROP POLICY IF EXISTS "requests_select" ON public.requests;
CREATE POLICY "requests_select" ON public.requests
  FOR SELECT TO authenticated
  USING (
    -- Super_admin can see all requests
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR
    -- Area_admin can see requests in their area
    (
      public.has_role(auth.uid(), 'area_admin'::app_role_2)
      AND area_id = (SELECT area_id FROM public.profiles WHERE id = auth.uid())
    )
    OR
    -- Admin and manager can see all requests
    public.has_role(auth.uid(), 'admin'::app_role_2)
    OR public.has_role(auth.uid(), 'manager'::app_role_2)
    OR
    -- Users can see requests in their area or without area
    (
      area_id IS NULL
      OR area_id = (SELECT area_id FROM public.profiles WHERE id = auth.uid())
    )
    OR
    -- Users can see their own requests
    created_by = auth.uid()
    OR
    -- Viewers can see all requests (read-only)
    public.has_role(auth.uid(), 'viewer'::app_role_2)
  );

-- Update requests_update policy to respect area
DROP POLICY IF EXISTS "requests_update" ON public.requests;
CREATE POLICY "requests_update" ON public.requests
  FOR UPDATE TO authenticated
  USING (
    -- Super_admin can update all requests
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR
    -- Area_admin can update requests in their area
    (
      public.has_role(auth.uid(), 'area_admin'::app_role_2)
      AND area_id = (SELECT area_id FROM public.profiles WHERE id = auth.uid())
    )
    OR
    -- Admin and manager can update all requests
    public.has_role(auth.uid(), 'admin'::app_role_2)
    OR public.has_role(auth.uid(), 'manager'::app_role_2)
    OR
    -- Client can update their own requests
    (
      created_by = auth.uid()
      AND public.has_role(auth.uid(), 'client'::app_role_2)
    )
  )
  WITH CHECK (
    -- Super_admin can set any area_id
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR
    -- Area_admin can set any area_id in their area
    (
      public.has_role(auth.uid(), 'area_admin'::app_role_2)
      AND area_id = (SELECT area_id FROM public.profiles WHERE id = auth.uid())
    )
    OR
    -- Admin and manager can set any area_id
    public.has_role(auth.uid(), 'admin'::app_role_2)
    OR public.has_role(auth.uid(), 'manager'::app_role_2)
    OR
    -- Client can only set their own area_id or null
    (
      area_id IS NULL
      OR area_id = (SELECT area_id FROM public.profiles WHERE id = auth.uid())
    )
  );

-- requests_delete policy remains the same (admin and manager only)
DROP POLICY IF EXISTS "requests_delete" ON public.requests;
CREATE POLICY "requests_delete" ON public.requests
  FOR DELETE TO authenticated
  USING (
    public.has_role(auth.uid(), 'super_admin'::app_role_2)
    OR public.has_role(auth.uid(), 'area_admin'::app_role_2)
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
    OR public.has_role(auth.uid(), 'manager'::app_role_2)
  );

-- Remove automatic 'client' role assignment and add admin notification for new users

-- Function to check if a user has any role at all
CREATE OR REPLACE FUNCTION public.has_any_role(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles_smart_path WHERE user_id = _user_id)
$$;

-- First, modify the handle_new_user function to NOT assign 'client' role automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_first_user BOOLEAN;
BEGIN
  INSERT INTO public.profiles (id, full_name, email)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email), NEW.email)
  ON CONFLICT (id) DO NOTHING;

  -- Only assign 'admin' role to the very first user
  SELECT NOT EXISTS (SELECT 1 FROM public.user_roles_smart_path) INTO is_first_user;
  IF is_first_user THEN
    INSERT INTO public.user_roles_smart_path (user_id, role) VALUES (NEW.id, 'admin'::app_role_2) ON CONFLICT DO NOTHING;
  END IF;
  
  -- Notify all admins about the new user registration
  IF NOT is_first_user THEN
    INSERT INTO public.notifications (user_id, type, title, body, data, read)
    SELECT 
      ur.user_id, 
      'user_registered'::text, 
      'Nuevo usuario registrado', 
      'Un nuevo usuario se ha registrado y espera autorización: ' || COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
      jsonb_build_object('new_user_id', NEW.id, 'email', NEW.email, 'full_name', COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email)),
      false
    FROM public.user_roles_smart_path ur
    WHERE ur.role = 'admin'::app_role_2;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Update requests policies to require users to have at least one role
DROP POLICY IF EXISTS "requests_insert" ON public.requests;
CREATE POLICY "requests_insert" ON public.requests
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND public.has_any_role(auth.uid())
    AND NOT public.has_role(auth.uid(), 'viewer'::app_role_2)
  );

DROP POLICY IF EXISTS "requests_update" ON public.requests;
CREATE POLICY "requests_update" ON public.requests
  FOR UPDATE TO authenticated
  USING (
    public.has_any_role(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role_2)
      OR public.has_role(auth.uid(), 'manager'::app_role_2)
      OR (created_by = auth.uid() AND public.has_role(auth.uid(), 'client'::app_role_2))
    )
  );

-- Update chat policies to require users to have at least one role
DROP POLICY IF EXISTS "chat_conv_insert" ON public.chat_conversations;
CREATE POLICY "chat_conv_insert" ON public.chat_conversations
  FOR INSERT TO authenticated 
  WITH CHECK (user_id = auth.uid() AND public.has_any_role(auth.uid()));

DROP POLICY IF EXISTS "chat_msg_insert" ON public.chat_messages;
CREATE POLICY "chat_msg_insert" ON public.chat_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_any_role(auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.chat_conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );

-- Add 'user_registered' to the notification type comment for documentation
COMMENT ON COLUMN public.notifications.type IS 'request_created | request_assigned | status_changed | comment_added | role_changed | user_registered';

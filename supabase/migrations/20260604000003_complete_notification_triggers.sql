-- Complete notification triggers for all notification types
-- This migration adds missing triggers and improves existing ones

-- ============================================
-- 1. Update comment trigger to notify assigned user
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_new_comment()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_request public.requests%rowtype;
BEGIN
  SELECT * INTO v_request FROM public.requests WHERE id = new.request_id;
  
  -- Notify creator if not the one making the comment
  IF v_request.created_by IS NOT NULL AND v_request.created_by != new.user_id THEN
    INSERT INTO public.notifications(user_id, type, title, body, data)
    VALUES (
      v_request.created_by,
      'comment_added',
      'Nuevo comentario en tu solicitud',
      'Se añadió un comentario en "' || v_request.title || '".',
      jsonb_build_object('request_id', new.request_id, 'comment_id', new.id)
    );
  END IF;
  
  -- Notify assigned user if different from creator and commenter
  IF v_request.assigned_to IS NOT NULL 
     AND v_request.assigned_to != v_request.created_by 
     AND v_request.assigned_to != new.user_id THEN
    INSERT INTO public.notifications(user_id, type, title, body, data)
    VALUES (
      v_request.assigned_to,
      'comment_added',
      'Nuevo comentario en solicitud asignada',
      'Se añadió un comentario en "' || v_request.title || '".',
      jsonb_build_object('request_id', new.request_id, 'comment_id', new.id)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- ============================================
-- 2. Add trigger for request_created
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_request_created()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Notify admins and managers about new request
  INSERT INTO public.notifications(user_id, type, title, body, data)
  SELECT 
    ur.user_id,
    'request_created',
    'Nueva solicitud creada',
    'Se ha creado una nueva solicitud: "' || NEW.title || '"',
    jsonb_build_object('request_id', NEW.id, 'title', NEW.title, 'created_by', NEW.created_by)
  FROM public.user_roles_smart_path ur
  WHERE ur.role IN ('admin'::app_role_2, 'manager'::app_role_2)
    AND ur.user_id != NEW.created_by; -- Don't notify the creator themselves
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_request_created ON public.requests;
CREATE TRIGGER on_request_created
  AFTER INSERT ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_request_created();

-- ============================================
-- 3. Add trigger for request_assigned
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_request_assigned()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Notify when assigned_to changes
  IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
    -- If assigned to someone
    IF NEW.assigned_to IS NOT NULL THEN
      -- Notify the assigned user
      INSERT INTO public.notifications(user_id, type, title, body, data)
      VALUES (
        NEW.assigned_to,
        'request_assigned',
        'Solicitud asignada',
        'Se te ha asignado la solicitud: "' || NEW.title || '"',
        jsonb_build_object('request_id', NEW.id, 'title', NEW.title)
      );
    END IF;
    
    -- Notify creator if different from assigned user and not the one making the change
    IF NEW.created_by IS NOT NULL 
       AND NEW.created_by != NEW.assigned_to 
       AND NEW.created_by != auth.uid() THEN
      INSERT INTO public.notifications(user_id, type, title, body, data)
      VALUES (
        NEW.created_by,
        'request_assigned',
        'Solicitud reasignada',
        'Tu solicitud "' || NEW.title || '" ha sido reasignada.',
        jsonb_build_object('request_id', NEW.id, 'title', NEW.title)
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_request_assigned ON public.requests;
CREATE TRIGGER on_request_assigned
  AFTER UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_request_assigned();

-- ============================================
-- 4. Add trigger for role_changed
-- ============================================
CREATE OR REPLACE FUNCTION public.notify_role_changed()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- Notify user when their role changes
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.notifications(user_id, type, title, body, data)
    VALUES (
      NEW.user_id,
      'role_changed',
      'Rol asignado',
      'Se te ha asignado el rol: ' || NEW.role,
      jsonb_build_object('role', NEW.role)
    );
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.role IS DISTINCT FROM NEW.role THEN
      INSERT INTO public.notifications(user_id, type, title, body, data)
      VALUES (
        NEW.user_id,
        'role_changed',
        'Rol actualizado',
        'Tu rol ha cambiado de ' || OLD.role || ' a ' || NEW.role,
        jsonb_build_object('old_role', OLD.role, 'new_role', NEW.role)
      );
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.notifications(user_id, type, title, body, data)
    VALUES (
      OLD.user_id,
      'role_changed',
      'Rol eliminado',
      'Se te ha eliminado el rol: ' || OLD.role,
      jsonb_build_object('role', OLD.role)
    );
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_role_changed ON public.user_roles_smart_path;
CREATE TRIGGER on_role_changed
  AFTER INSERT OR UPDATE OR DELETE ON public.user_roles_smart_path
  FOR EACH ROW EXECUTE FUNCTION public.notify_role_changed();

-- ============================================
-- 5. Update notification type comment
-- ============================================
COMMENT ON COLUMN public.notifications.type IS 'request_created | request_assigned | status_changed | comment_added | role_changed | user_registered';

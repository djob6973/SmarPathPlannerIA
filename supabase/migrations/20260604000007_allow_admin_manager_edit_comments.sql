-- Permitir que admin y manager puedan editar comentarios de otros usuarios
-- Actualizar la política users_update_own_comments para incluir admin y manager

DROP POLICY IF EXISTS "users_update_own_comments" ON public.comments;

CREATE POLICY "users_update_own_comments"
  ON public.comments FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::app_role_2)
    OR public.has_role(auth.uid(), 'manager'::app_role_2)
  );

-- Notifications table
create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null, -- 'request_created' | 'request_assigned' | 'status_changed' | 'comment_added' | 'role_changed'
  title       text not null,
  body        text,
  data        jsonb default '{}',
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Comments table
create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  request_id  uuid not null references public.requests(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  content     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Indexes
create index if not exists notifications_user_id_idx on public.notifications(user_id);
create index if not exists notifications_read_idx on public.notifications(user_id, read);
create index if not exists comments_request_id_idx on public.comments(request_id);

-- Trigger for updated_at on comments
drop trigger if exists comments_updated_at on public.comments;
create trigger comments_updated_at
  before update on public.comments
  for each row execute procedure public.update_updated_at_column();

-- RLS: notifications
alter table public.notifications enable row level security;

drop policy if exists "users_see_own_notifications" on public.notifications;
create policy "users_see_own_notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

drop policy if exists "users_update_own_notifications" on public.notifications;
create policy "users_update_own_notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

drop policy if exists "service_insert_notifications" on public.notifications;
create policy "service_insert_notifications"
  on public.notifications for insert
  with check (true);

-- RLS: comments
alter table public.comments enable row level security;

drop policy if exists "authenticated_see_comments" on public.comments;
create policy "authenticated_see_comments"
  on public.comments for select
  using (auth.role() = 'authenticated');

drop policy if exists "users_insert_own_comments" on public.comments;
create policy "users_insert_own_comments"
  on public.comments for insert
  with check (auth.uid() = user_id);

drop policy if exists "users_update_own_comments" on public.comments;
create policy "users_update_own_comments"
  on public.comments for update
  using (auth.uid() = user_id);

drop policy if exists "admins_delete_comments" on public.comments;
create policy "admins_delete_comments"
  on public.comments for delete
  using (public.has_role(auth.uid(), 'admin'::app_role_2) or auth.uid() = user_id);

-- Function: notify on request status change
create or replace function public.notify_status_change()
returns trigger language plpgsql security definer as $$
begin
  if old.status_column_id is distinct from new.status_column_id then
    -- Notify creator if not the one making the change
    if new.created_by != auth.uid() then
      insert into public.notifications(user_id, type, title, body, data)
      values (
        new.created_by,
        'status_changed',
        'Estado de solicitud actualizado',
        'Tu solicitud "' || new.title || '" cambió de estado.',
        jsonb_build_object('request_id', new.id, 'title', new.title)
      );
    end if;
    -- Notify assigned user if different
    if new.assigned_to is not null and new.assigned_to != new.created_by and new.assigned_to != auth.uid() then
      insert into public.notifications(user_id, type, title, body, data)
      values (
        new.assigned_to,
        'status_changed',
        'Estado de solicitud actualizado',
        'La solicitud "' || new.title || '" cambió de estado.',
        jsonb_build_object('request_id', new.id, 'title', new.title)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists on_request_status_change on public.requests;
create trigger on_request_status_change
  after update on public.requests
  for each row execute procedure public.notify_status_change();

-- Function: notify on comment added
create or replace function public.notify_new_comment()
returns trigger language plpgsql security definer as $$
declare
  v_request public.requests%rowtype;
begin
  select * into v_request from public.requests where id = new.request_id;
  if v_request.created_by is not null and v_request.created_by != new.user_id then
    insert into public.notifications(user_id, type, title, body, data)
    values (
      v_request.created_by,
      'comment_added',
      'Nuevo comentario en tu solicitud',
      'Se añadió un comentario en "' || v_request.title || '".',
      jsonb_build_object('request_id', new.request_id, 'comment_id', new.id)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_comment_added on public.comments;
create trigger on_comment_added
  after insert on public.comments
  for each row execute procedure public.notify_new_comment();

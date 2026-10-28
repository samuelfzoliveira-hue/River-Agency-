-- RIVER OS — registro de horas (cronômetro e lançamento manual). tasks.logged_hours passa a ser a soma dos lançamentos.

create table public.time_entries (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  minutes int check (minutes is null or (minutes > 0 and minutes <= 1440)),
  note text,
  created_at timestamptz not null default now(),
  check ((ended_at is null) = (minutes is null))
);
create index time_entries_task_idx on public.time_entries (task_id);
create index time_entries_user_idx on public.time_entries (user_id, started_at desc);
-- no máximo um cronômetro rodando por pessoa
create unique index time_entries_one_running on public.time_entries (user_id) where ended_at is null;

alter table public.time_entries enable row level security;
revoke all on public.time_entries from anon;
create policy time_select on public.time_entries for select using (public.is_staff() and org_id = public.app_org());
create policy time_delete on public.time_entries for delete using (org_id = public.app_org() and (user_id = auth.uid() or public.is_manager()));

create function public.sync_logged_hours() returns trigger language plpgsql security definer set search_path = public as $$
declare t uuid := coalesce(new.task_id, old.task_id);
begin
  update public.tasks set logged_hours = round(coalesce((select sum(minutes) from public.time_entries where task_id = t and ended_at is not null), 0) / 60.0, 1) where id = t;
  return null;
end $$;
create trigger sync_logged_hours after insert or update or delete on public.time_entries for each row execute function public.sync_logged_hours();

-- Encerra o cronômetro da pessoa. Mínimo de 1 min; teto de 12 h (cronômetro esquecido não distorce relatórios).
create function public._stop_running(p_user uuid) returns int language plpgsql security definer set search_path = public as $$
declare e public.time_entries; m int;
begin
  select * into e from public.time_entries where user_id = p_user and ended_at is null for update;
  if not found then return 0; end if;
  m := least(greatest(round(extract(epoch from now() - e.started_at) / 60.0)::int, 1), 720);
  update public.time_entries set ended_at = now(), minutes = m where id = e.id;
  return m;
end $$;

create function public.start_timer(p_task uuid) returns uuid language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.app_org(); v_id uuid;
begin
  if not public.is_staff() then raise exception 'sem permissão'; end if;
  if not exists (select 1 from public.tasks where id = p_task and org_id = v_org) then raise exception 'tarefa não encontrada'; end if;
  perform public._stop_running(auth.uid());
  insert into public.time_entries (org_id, task_id, user_id) values (v_org, p_task, auth.uid()) returning id into v_id;
  update public.tasks set status = 'doing' where id = p_task and status = 'todo';
  return v_id;
end $$;

create function public.stop_timer() returns int language plpgsql security definer set search_path = public as $$
begin
  if not public.is_staff() then raise exception 'sem permissão'; end if;
  return public._stop_running(auth.uid());
end $$;

create function public.add_time_entry(p_task uuid, p_minutes int, p_day date, p_note text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.app_org(); v_id uuid; v_start timestamptz;
begin
  if not public.is_staff() then raise exception 'sem permissão'; end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 1440 then raise exception 'informe entre 1 minuto e 24 horas'; end if;
  if p_day > public.today_br() or p_day < public.today_br() - 90 then raise exception 'a data deve estar nos últimos 90 dias'; end if;
  if not exists (select 1 from public.tasks where id = p_task and org_id = v_org) then raise exception 'tarefa não encontrada'; end if;
  v_start := (p_day::text || ' 12:00:00-03')::timestamptz;
  insert into public.time_entries (org_id, task_id, user_id, started_at, ended_at, minutes, note)
    values (v_org, p_task, auth.uid(), v_start, v_start + make_interval(mins => p_minutes), p_minutes, nullif(trim(p_note), '')) returning id into v_id;
  return v_id;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.bootstrap_organization(text, text), public.ensure_monthly_targets(date), public.today_br(),
  public.app_org(), public.app_role(), public.is_staff(), public.is_manager(), public.is_admin(), public.client_ids(), public.status_in_approval_flow(uuid),
  public.close_month(uuid, date, jsonb, jsonb, text), public.reopen_month(uuid, text), public.request_approval(uuid, text, timestamptz),
  public.approval_view_portal(uuid), public.approval_decide_portal(uuid, text, text), public.portal_contents(),
  public.run_automations(uuid, boolean), public.start_timer(uuid), public.stop_timer(), public.add_time_entry(uuid, int, date, text) to authenticated;
grant execute on function public.approval_view(text), public.approval_decide(text, text, text, text) to anon, authenticated;
grant execute on function public.email_queue(int), public.email_mark_sent(uuid[]), public.run_automations(uuid, boolean) to service_role;

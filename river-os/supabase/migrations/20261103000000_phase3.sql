-- RIVER OS — Fase 3: histórico de etapas (base dos relatórios e previsões), automações e e-mail.

-- ───────────────────────── Histórico de etapas ─────────────────────────
-- Uma linha por permanência de um conteúdo em uma etapa. Linhas "backfilled" (conteúdos anteriores a esta migração)
-- não têm início real e ficam fora das médias.
create table public.content_status_history (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  status_id uuid not null references public.pipeline_statuses (id),
  stage smallint not null,
  approval_state text,
  entered_at timestamptz not null default now(),
  left_at timestamptz,
  entered_by uuid references auth.users (id) on delete set null,
  backfilled boolean not null default false
);
create index csh_content_idx on public.content_status_history (content_id, entered_at);
create index csh_org_entered_idx on public.content_status_history (org_id, entered_at);
create index csh_open_idx on public.content_status_history (content_id) where left_at is null;

create function public.track_status_history() returns trigger language plpgsql security definer set search_path = public as $$
declare s record;
begin
  if tg_op = 'UPDATE' and new.status_id is not distinct from old.status_id then return new; end if;
  select stage, approval_state into s from public.pipeline_statuses where id = new.status_id;
  if tg_op = 'UPDATE' then
    update public.content_status_history set left_at = now() where content_id = new.id and left_at is null;
  end if;
  insert into public.content_status_history (org_id, content_id, status_id, stage, approval_state, entered_at, entered_by)
    values (new.org_id, new.id, new.status_id, coalesce(s.stage, 0), s.approval_state, case when tg_op = 'INSERT' then new.created_at else now() end, auth.uid());
  return new;
end $$;
create trigger track_status_history after insert or update of status_id on public.contents for each row execute function public.track_status_history();

insert into public.content_status_history (org_id, content_id, status_id, stage, approval_state, entered_at, backfilled)
  select c.org_id, c.id, c.status_id, c.delivery_stage, s.approval_state, c.status_changed_at, true
  from public.contents c join public.pipeline_statuses s on s.id = c.status_id;

alter table public.content_status_history enable row level security;
revoke all on public.content_status_history from anon;
create policy csh_select on public.content_status_history for select using (public.is_staff() and org_id = public.app_org());

-- ───────────────────────── Automações (notificações por regra) ─────────────────────────
create table public.automation_log (
  org_id uuid not null references public.organizations (id) on delete cascade,
  key text not null,
  created_at timestamptz not null default now(),
  primary key (org_id, key)
);
create table public.automation_runs (
  org_id uuid primary key references public.organizations (id) on delete cascade,
  last_run_at timestamptz not null
);
alter table public.automation_log enable row level security;
alter table public.automation_runs enable row level security;
revoke all on public.automation_log, public.automation_runs from anon, authenticated;

-- Gera notificações idempotentes (uma por regra/entidade/dia). Chamada pelo app e, opcionalmente, por pg_cron.
create function public._automation_notify(p_org uuid, p_key text, p_user uuid, p_type text, p_title text, p_body text, p_link text) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_ok boolean;
begin
  if p_user is null then return false; end if;
  insert into public.automation_log (org_id, key) values (p_org, p_user || ':' || p_key) on conflict do nothing;
  get diagnostics v_ok = row_count;
  if not v_ok then return false; end if;
  insert into public.notifications (org_id, user_id, type, title, body, link) values (p_org, p_user, p_type, p_title, p_body, p_link);
  return true;
end $$;

create function public.run_automations(p_org uuid default null, p_force boolean default false) returns integer
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_n int := 0; v_today date := public.today_br(); r record; cfg public.alert_settings; v_last timestamptz;
begin
  -- chamada pelo usuário: usa a própria agência; chamada interna (pg_cron, sem usuário): informa p_org
  if auth.uid() is not null then
    if not public.is_staff() then raise exception 'sem permissão'; end if;
    v_org := public.app_org();
  else v_org := p_org; end if;
  if v_org is null then raise exception 'agência não informada'; end if;

  select last_run_at into v_last from public.automation_runs where org_id = v_org;
  if v_last is not null and v_last > now() - interval '30 minutes' and not (p_force and (auth.uid() is null or public.is_manager())) then return 0; end if;
  insert into public.automation_runs (org_id, last_run_at) values (v_org, now())
    on conflict (org_id) do update set last_run_at = excluded.last_run_at;
  select * into cfg from public.alert_settings where org_id = v_org and client_id is null and deliverable_type_id is null;
  if not found then cfg.approval_wait_hours := 48; cfg.deadline_warning_days := 2; cfg.contract_end_warning_days := 30; end if;

  -- 1) tarefa próxima do prazo → responsável
  for r in select t.id, t.title, t.assignee_id, t.due_date from public.tasks t
           where t.org_id = v_org and t.status in ('todo', 'doing') and t.assignee_id is not null
             and t.due_date between v_today and v_today + cfg.deadline_warning_days loop
    if public._automation_notify(v_org, 'prazo:' || r.id || ':' || v_today, r.assignee_id, 'prazo_proximo',
         'Prazo próximo: ' || r.title, 'Vence em ' || to_char(r.due_date, 'DD/MM/YYYY') || '.', '/tarefas?tarefa=' || r.id) then v_n := v_n + 1; end if;
  end loop;

  -- 2) tarefa atrasada → responsável; resumo diário → gestores
  for r in select t.id, t.title, t.assignee_id, t.due_date from public.tasks t
           where t.org_id = v_org and t.status in ('todo', 'doing') and t.assignee_id is not null and t.due_date < v_today loop
    if public._automation_notify(v_org, 'atraso:' || r.id || ':' || v_today, r.assignee_id, 'tarefa_atrasada',
         'Tarefa atrasada: ' || r.title, 'Venceu em ' || to_char(r.due_date, 'DD/MM/YYYY') || '.', '/tarefas?tarefa=' || r.id) then v_n := v_n + 1; end if;
  end loop;
  for r in select p.user_id, (select count(*) from public.tasks t where t.org_id = v_org and t.status in ('todo', 'doing') and t.due_date < v_today) as late
           from public.profiles p where p.org_id = v_org and p.active and p.role in ('admin', 'gestor') loop
    if r.late > 0 and public._automation_notify(v_org, 'resumo-atraso:' || v_today, r.user_id, 'atraso_gestor',
         r.late || (case when r.late = 1 then ' tarefa atrasada' else ' tarefas atrasadas' end) || ' na agência', 'Veja a Central de Operações.', '/operacoes') then v_n := v_n + 1; end if;
  end loop;

  -- 3) cliente demorando para aprovar → responsável pelo cliente e gestores
  for r in select c.id, c.title, c.client_id, cl.owner_id, cl.name from public.contents c join public.clients cl on cl.id = c.client_id
           join public.pipeline_statuses s on s.id = c.status_id
           where c.org_id = v_org and c.cancelled_at is null and s.approval_state = 'aguardando'
             and c.status_changed_at < now() - make_interval(hours => cfg.approval_wait_hours) loop
    if public._automation_notify(v_org, 'aprov:' || r.id || ':' || v_today, r.owner_id, 'aprovacao_lenta',
         r.name || ' está demorando para aprovar', '“' || r.title || '” aguarda há mais de ' || cfg.approval_wait_hours || 'h.', '/conteudos/' || r.id) then v_n := v_n + 1; end if;
  end loop;

  -- 4) contrato perto do encerramento → gestores
  for r in select k.id, k.end_date, cl.name from public.contracts k join public.clients cl on cl.id = k.client_id
           where k.org_id = v_org and k.status = 'ativo' and cl.status = 'ativo' and k.end_date between v_today and v_today + cfg.contract_end_warning_days loop
    declare m record; begin
      for m in select user_id from public.profiles where org_id = v_org and active and role in ('admin', 'gestor') loop
        if public._automation_notify(v_org, 'fim-contrato:' || r.id || ':' || to_char(date_trunc('week', v_today), 'YYYY-MM-DD'), m.user_id, 'contrato_encerrando',
             'Contrato de ' || r.name || ' encerra em ' || to_char(r.end_date, 'DD/MM/YYYY'), 'Planeje a renovação.', '/clientes/' || (select client_id from public.contracts where id = r.id)) then v_n := v_n + 1; end if;
      end loop;
    end;
  end loop;
  return v_n;
end $$;

-- ───────────────────────── Fila de e-mail (estrutura pronta; o envio é feito por rota protegida) ─────────────────────────
-- notifications.email_sent_at já existe; esta função expõe a fila apenas ao papel de serviço.
create function public.email_queue(p_limit int default 50) returns table (id uuid, email text, full_name text, title text, body text, link text)
language sql stable security definer set search_path = public as $$
  select n.id, p.email, p.full_name, n.title, n.body, n.link
  from public.notifications n join public.profiles p on p.user_id = n.user_id
  where n.email_sent_at is null and p.active and p.email is not null and n.created_at > now() - interval '2 days'
  order by n.created_at limit least(p_limit, 200) $$;
create function public.email_mark_sent(p_ids uuid[]) returns void language sql security definer set search_path = public as
  $$ update public.notifications set email_sent_at = now() where id = any(p_ids) $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.bootstrap_organization(text, text), public.ensure_monthly_targets(date), public.today_br(),
  public.app_org(), public.app_role(), public.is_staff(), public.is_manager(), public.is_admin(), public.client_ids(), public.status_in_approval_flow(uuid),
  public.close_month(uuid, date, jsonb, jsonb, text), public.reopen_month(uuid, text), public.request_approval(uuid, text, timestamptz),
  public.approval_view_portal(uuid), public.approval_decide_portal(uuid, text, text), public.portal_contents(),
  public.run_automations(uuid, boolean) to authenticated;
grant execute on function public.approval_view(text), public.approval_decide(text, text, text, text) to anon, authenticated;
-- apenas o papel de serviço (rota de cron) lê/marca a fila de e-mail
grant execute on function public.email_queue(int), public.email_mark_sent(uuid[]), public.run_automations(uuid, boolean) to service_role;

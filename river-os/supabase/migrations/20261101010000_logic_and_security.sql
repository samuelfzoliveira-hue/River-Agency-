-- RIVER OS — Fase 1: funções, triggers e segurança (RLS).

-- ───────────────────────── Auxiliares de identidade ─────────────────────────
create function public.app_org() returns uuid language sql stable security definer set search_path = public as
  $$ select org_id from public.profiles where user_id = auth.uid() and active $$;
create function public.app_role() returns public.user_role language sql stable security definer set search_path = public as
  $$ select role from public.profiles where user_id = auth.uid() and active $$;
create function public.is_staff() returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce((select role <> 'cliente' from public.profiles where user_id = auth.uid() and active), false) $$;
create function public.is_manager() returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce((select role in ('admin', 'gestor') from public.profiles where user_id = auth.uid() and active), false) $$;
create function public.is_admin() returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce((select role = 'admin' from public.profiles where user_id = auth.uid() and active), false) $$;
-- usada na RLS de contents: o papel "cliente" não lê pipeline_statuses diretamente.
create function public.status_in_approval_flow(p_status uuid) returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce((select approval_state is not null from public.pipeline_statuses where id = p_status), false) $$;
create function public.client_ids() returns setof uuid language sql stable security definer set search_path = public as
  $$ select client_id from public.client_users where user_id = auth.uid() $$;

-- ───────────────────────── Cadastro: convite ou nova agência ─────────────────────────
create function public.seed_org_defaults(p_org uuid) returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.deliverable_types (org_id, key, name, kind, default_hours, position) values
    (p_org, 'reel',      'Reel',                 'content', 6, 1),
    (p_org, 'post',      'Post estático',        'content', 2, 2),
    (p_org, 'carrossel', 'Carrossel',            'content', 4, 3),
    (p_org, 'story',     'Story',                'content', 1, 4),
    (p_org, 'captacao',  'Captação presencial',  'shoot',   3, 5);
  insert into public.pipeline_statuses (org_id, name, position, stage, approval_state) values
    (p_org, 'Ideia',                          1, 0, null),
    (p_org, 'Planejamento',                   2, 0, null),
    (p_org, 'Roteiro',                        3, 0, null),
    (p_org, 'Aguardando captação',            4, 0, null),
    (p_org, 'Captado',                        5, 0, null),
    (p_org, 'Em edição/design',               6, 0, null),
    (p_org, 'Revisão interna',                7, 1, null),
    (p_org, 'Aguardando aprovação do cliente',8, 1, 'aguardando'),
    (p_org, 'Ajustes solicitados',            9, 1, 'ajustes'),
    (p_org, 'Aprovado',                      10, 2, 'aprovado'),
    (p_org, 'Agendado',                      11, 3, 'aprovado'),
    (p_org, 'Publicado',                     12, 4, 'aprovado');
  insert into public.alert_settings (org_id) values (p_org);
end $$;

create function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_inv public.invites;
begin
  select * into v_inv from public.invites where email = lower(new.email) and accepted_at is null order by created_at limit 1;
  if found then
    insert into public.profiles (user_id, org_id, role, full_name, email)
    values (new.id, v_inv.org_id, v_inv.role,
            coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), v_inv.full_name, split_part(new.email, '@', 1)),
            lower(new.email));
    update public.invites set accepted_at = now() where id = v_inv.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Quem entra sem convite cria a própria agência (ele vira administrador dela).
create function public.bootstrap_organization(p_org_name text, p_full_name text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid; v_email text;
begin
  if auth.uid() is null then raise exception 'não autenticado'; end if;
  if exists (select 1 from public.profiles where user_id = auth.uid()) then raise exception 'usuário já pertence a uma agência'; end if;
  if length(trim(coalesce(p_org_name, ''))) = 0 then raise exception 'nome da agência é obrigatório'; end if;
  select lower(email) into v_email from auth.users where id = auth.uid();
  insert into public.organizations (name) values (trim(p_org_name)) returning id into v_org;
  insert into public.profiles (user_id, org_id, role, full_name, email)
    values (auth.uid(), v_org, 'admin', coalesce(nullif(trim(p_full_name), ''), split_part(v_email, '@', 1)), v_email);
  perform public.seed_org_defaults(v_org);
  return v_org;
end $$;

-- Só administradores alteram papéis; ninguém remove o último administrador.
create function public.guard_profile() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role or new.org_id is distinct from old.org_id then
    if new.org_id is distinct from old.org_id then raise exception 'organização não pode ser alterada'; end if;
    if auth.uid() is not null and not public.is_admin() then raise exception 'apenas administradores alteram papéis'; end if;
  end if;
  if old.role = 'admin' and (new.role <> 'admin' or not new.active)
     and not exists (select 1 from public.profiles where org_id = old.org_id and role = 'admin' and active and user_id <> old.user_id) then
    raise exception 'a agência precisa de ao menos um administrador ativo';
  end if;
  return new;
end $$;
create trigger guard_profile before update on public.profiles for each row execute function public.guard_profile();

-- ───────────────────────── Metas mensais ─────────────────────────
-- Gera (sem sobrescrever) as metas da competência a partir do pacote de cada contrato ativo.
-- weekly = qtd × segundas-feiras do mês · biweekly = qtd × ceil(segundas/2) · monthly = qtd.
create function public.ensure_monthly_targets(p_month date) returns integer
language plpgsql security definer set search_path = public as $$
declare v_month date := date_trunc('month', p_month)::date;
        v_end date := (date_trunc('month', p_month) + interval '1 month - 1 day')::date;
        v_mondays int; v_n int;
begin
  if not public.is_staff() then raise exception 'sem permissão'; end if;
  select count(*) into v_mondays from generate_series(v_month, v_end, interval '1 day') d where extract(isodow from d) = 1;
  insert into public.monthly_targets (org_id, contract_id, client_id, competence, deliverable_type_id, quantity, periodicity, completion_criterion)
  select c.org_id, c.id, c.client_id, v_month, i.deliverable_type_id,
         case i.periodicity when 'weekly' then i.quantity * v_mondays
                            when 'biweekly' then i.quantity * ceil(v_mondays / 2.0)::int
                            else i.quantity end,
         i.periodicity, c.completion_criterion
  from public.contracts c
  join public.contract_items i on i.contract_id = c.id
  join public.clients cl on cl.id = c.client_id
  where c.org_id = public.app_org() and c.status = 'ativo' and cl.status = 'ativo'
    and c.start_date <= v_end and (c.end_date is null or c.end_date >= v_month)
  on conflict (contract_id, competence, deliverable_type_id) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- ───────────────────────── Triggers de conteúdo ─────────────────────────
create function public.contents_before() returns trigger language plpgsql security definer set search_path = public as $$
declare v_stage smallint; v_appr text; v_type uuid;
begin
  select stage, approval_state, deliverable_type_id into v_stage, v_appr, v_type from public.pipeline_statuses where id = new.status_id;
  if v_type is not null and v_type <> new.deliverable_type_id then
    raise exception 'etapa não pertence ao tipo de projeto do conteúdo';
  end if;
  new.delivery_stage := coalesce(v_stage, 0);
  new.updated_at := now();
  if tg_op = 'INSERT' or new.status_id is distinct from old.status_id then
    new.status_changed_at := now();
    if v_appr = 'aprovado' and new.delivery_stage >= 2 and (tg_op = 'INSERT' or old.delivery_stage < 2) then
      new.approved_at := now(); new.approved_by := auth.uid();
    end if;
  end if;
  if new.delivery_stage >= 4 and (tg_op = 'INSERT' or old.delivery_stage < 4) then
    new.published_at := now();
    new.published_late := new.publish_date is not null and public.today_br() > new.publish_date;
  end if;
  return new;
end $$;
create trigger contents_before before insert or update on public.contents for each row execute function public.contents_before();

create function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
create trigger clients_touch before update on public.clients for each row execute function public.touch_updated_at();
create trigger shoots_touch before update on public.shoots for each row execute function public.touch_updated_at();

create function public.tasks_before() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if new.status = 'done' and (tg_op = 'INSERT' or old.status <> 'done') then new.completed_at := now();
  elsif new.status <> 'done' then new.completed_at := null; end if;
  return new;
end $$;
create trigger tasks_before before insert or update on public.tasks for each row execute function public.tasks_before();

-- ───────────────────────── Histórico de alterações ─────────────────────────
create function public.log_activity() returns trigger language plpgsql security definer set search_path = public as $$
declare n jsonb := to_jsonb(new); o jsonb; d jsonb := '{}'; k text; v jsonb; ov jsonb;
        v_ent text := case tg_table_name when 'contents' then 'content' when 'tasks' then 'task' when 'shoots' then 'shoot'
                                         when 'clients' then 'client' when 'contracts' then 'contract' else tg_table_name end;
        v_client uuid := case when tg_table_name = 'clients' then (n->>'id')::uuid else nullif(n->>'client_id', '')::uuid end;
        v_action text; v_old_name text; v_new_name text;
begin
  if tg_op = 'INSERT' then
    insert into public.activity_log (org_id, entity_type, entity_id, client_id, actor_id, action, details)
    values (new.org_id, v_ent, (n->>'id')::uuid, v_client, auth.uid(), 'criado', jsonb_build_object('titulo', coalesce(n->>'title', n->>'name')));
    return new;
  end if;
  o := to_jsonb(old);
  for k, v in select * from jsonb_each(n) loop
    continue when k in ('updated_at', 'status_changed_at', 'delivery_stage', 'attachments');
    ov := o->k;
    if v is distinct from ov then
      d := d || jsonb_build_object(k, jsonb_build_object(
        'de',   case when jsonb_typeof(ov) = 'string' then to_jsonb(left(ov #>> '{}', 200)) else ov end,
        'para', case when jsonb_typeof(v)  = 'string' then to_jsonb(left(v  #>> '{}', 200)) else v end));
    end if;
  end loop;
  if d = '{}' then return new; end if;
  if d ? 'status_id' then
    select name into v_old_name from public.pipeline_statuses where id = (o->>'status_id')::uuid;
    select name into v_new_name from public.pipeline_statuses where id = (n->>'status_id')::uuid;
    d := d || jsonb_build_object('status', jsonb_build_object('de', v_old_name, 'para', v_new_name));
    v_action := 'status';
  else
    v_action := 'atualizado';
  end if;
  insert into public.activity_log (org_id, entity_type, entity_id, client_id, actor_id, action, details)
  values (new.org_id, v_ent, (n->>'id')::uuid, v_client, auth.uid(), v_action, d);
  return new;
end $$;
create trigger log_contents after insert or update on public.contents for each row execute function public.log_activity();
create trigger log_tasks    after insert or update on public.tasks    for each row execute function public.log_activity();
create trigger log_shoots   after insert or update on public.shoots   for each row execute function public.log_activity();
create trigger log_clients  after insert or update on public.clients  for each row execute function public.log_activity();
create trigger log_contracts after insert or update on public.contracts for each row execute function public.log_activity();

-- ───────────────────────── Notificações automáticas ─────────────────────────
create function public.push_notification(p_org uuid, p_user uuid, p_type text, p_title text, p_body text, p_link text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_user is null or p_user is not distinct from auth.uid() then return; end if;
  insert into public.notifications (org_id, user_id, type, title, body, link) values (p_org, p_user, p_type, p_title, p_body, p_link);
end $$;

create function public.notify_task_assignment() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform public.push_notification(new.org_id, new.assignee_id, 'tarefa_atribuida', 'Nova tarefa: ' || new.title,
      case when new.due_date is not null then 'Prazo: ' || to_char(new.due_date, 'DD/MM/YYYY') end, '/tarefas?tarefa=' || new.id);
  end if;
  return new;
end $$;
create trigger notify_task_assignment after insert or update of assignee_id on public.tasks for each row execute function public.notify_task_assignment();

create function public.notify_content_events() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.assignee_id is not null and (tg_op = 'INSERT' or new.assignee_id is distinct from old.assignee_id) then
    perform public.push_notification(new.org_id, new.assignee_id, 'conteudo_atribuido', 'Conteúdo atribuído: ' || new.title, null, '/conteudos/' || new.id);
  end if;
  -- aprovado → avisa o social media
  if tg_op = 'UPDATE' and new.delivery_stage >= 2 and old.delivery_stage < 2 then
    for r in select user_id from public.profiles where org_id = new.org_id and role = 'social' and active loop
      perform public.push_notification(new.org_id, r.user_id, 'conteudo_aprovado', 'Conteúdo aprovado: ' || new.title, 'Pronto para agendar/publicar.', '/conteudos/' || new.id);
    end loop;
  end if;
  return new;
end $$;
create trigger notify_content_events after insert or update on public.contents for each row execute function public.notify_content_events();

-- captação concluída → avisa quem edita os conteúdos vinculados
create function public.notify_shoot_done() returns trigger language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status = 'realizada' and old.status <> 'realizada' then
    for r in select distinct c.assignee_id from public.shoot_contents sc join public.contents c on c.id = sc.content_id
             where sc.shoot_id = new.id and c.assignee_id is not null loop
      perform public.push_notification(new.org_id, r.assignee_id, 'captacao_concluida', 'Captação concluída: ' || new.title, 'Material disponível para edição.', '/captacoes');
    end loop;
  end if;
  return new;
end $$;
create trigger notify_shoot_done after update of status on public.shoots for each row execute function public.notify_shoot_done();

create function public.notify_mentions() returns trigger language plpgsql security definer set search_path = public as $$
declare u uuid; v_link text;
begin
  v_link := case new.entity_type when 'content' then '/conteudos/' || new.entity_id when 'client' then '/clientes/' || new.entity_id
                                 when 'task' then '/tarefas?tarefa=' || new.entity_id else '/captacoes' end;
  foreach u in array new.mentions loop
    if exists (select 1 from public.profiles where user_id = u and org_id = new.org_id) then
      perform public.push_notification(new.org_id, u, 'mencao', 'Você foi mencionado', left(new.body, 140), v_link);
    end if;
  end loop;
  return new;
end $$;
create trigger notify_mentions after insert on public.comments for each row execute function public.notify_mentions();

-- ───────────────────────── RLS ─────────────────────────
do $$ declare t text; begin
  foreach t in array array['organizations','profiles','invites','member_unavailability','deliverable_types','pipeline_statuses',
    'clients','client_financials','client_users','contracts','contract_items','monthly_targets','contents','content_supporters',
    'shoots','shoot_members','shoot_contents','tasks','task_supporters','events','comments','activity_log','notifications','alert_settings']
  loop execute format('alter table public.%I enable row level security', t); end loop;
end $$;
revoke all on all tables in schema public from anon;

create policy org_select on public.organizations for select using (id = public.app_org());

create policy profiles_select on public.profiles for select using (user_id = auth.uid() or (public.is_staff() and org_id = public.app_org()));
create policy profiles_update on public.profiles for update using (public.is_manager() and org_id = public.app_org()) with check (org_id = public.app_org());

create policy invites_select on public.invites for select using (public.is_manager() and org_id = public.app_org());
create policy invites_insert on public.invites for insert with check (public.is_manager() and org_id = public.app_org() and (role <> 'admin' or public.is_admin()));
create policy invites_delete on public.invites for delete using (public.is_manager() and org_id = public.app_org() and accepted_at is null);

create policy unavail_select on public.member_unavailability for select using (public.is_staff() and org_id = public.app_org());
create policy unavail_write on public.member_unavailability for all
  using (org_id = public.app_org() and (public.is_manager() or user_id = auth.uid()))
  with check (org_id = public.app_org() and (public.is_manager() or user_id = auth.uid()));

create policy types_select on public.deliverable_types for select using (public.is_staff() and org_id = public.app_org());
create policy types_write on public.deliverable_types for all using (public.is_admin() and org_id = public.app_org()) with check (public.is_admin() and org_id = public.app_org());
create policy statuses_select on public.pipeline_statuses for select using (public.is_staff() and org_id = public.app_org());
create policy statuses_write on public.pipeline_statuses for all using (public.is_admin() and org_id = public.app_org()) with check (public.is_admin() and org_id = public.app_org());

create policy clients_select on public.clients for select using (
  (public.is_staff() and org_id = public.app_org()) or id in (select public.client_ids()));
create policy clients_insert on public.clients for insert with check (public.is_manager() and org_id = public.app_org());
create policy clients_update on public.clients for update using (public.is_manager() and org_id = public.app_org()) with check (org_id = public.app_org());
create policy clients_delete on public.clients for delete using (public.is_admin() and org_id = public.app_org());

create policy fin_all on public.client_financials for all using (public.is_manager() and org_id = public.app_org()) with check (public.is_manager() and org_id = public.app_org());

create policy client_users_select on public.client_users for select using (user_id = auth.uid() or public.is_manager());
create policy client_users_write on public.client_users for all
  using (public.is_manager() and client_id in (select id from public.clients where org_id = public.app_org()))
  with check (public.is_manager() and client_id in (select id from public.clients where org_id = public.app_org()));

create policy contracts_select on public.contracts for select using (public.is_staff() and org_id = public.app_org());
create policy contracts_write on public.contracts for all using (public.is_manager() and org_id = public.app_org()) with check (public.is_manager() and org_id = public.app_org());
create policy items_select on public.contract_items for select using (public.is_staff() and contract_id in (select id from public.contracts where org_id = public.app_org()));
create policy items_write on public.contract_items for all
  using (public.is_manager() and contract_id in (select id from public.contracts where org_id = public.app_org()))
  with check (public.is_manager() and contract_id in (select id from public.contracts where org_id = public.app_org()));
create policy targets_select on public.monthly_targets for select using (public.is_staff() and org_id = public.app_org());
create policy targets_write on public.monthly_targets for all using (public.is_manager() and org_id = public.app_org()) with check (public.is_manager() and org_id = public.app_org());

create policy contents_select on public.contents for select using (
  (public.is_staff() and org_id = public.app_org())
  or (client_id in (select public.client_ids()) and cancelled_at is null
      and public.status_in_approval_flow(status_id)));
create policy contents_insert on public.contents for insert with check (public.is_staff() and org_id = public.app_org()
  and (contract_id is null or contract_id in (select id from public.contracts)));
create policy contents_update on public.contents for update using (public.is_staff() and org_id = public.app_org()) with check (org_id = public.app_org());
create policy contents_delete on public.contents for delete using (public.is_manager() and org_id = public.app_org());

create policy csup_select on public.content_supporters for select using (public.is_staff() and content_id in (select id from public.contents where org_id = public.app_org()));
create policy csup_write on public.content_supporters for all
  using (public.is_staff() and content_id in (select id from public.contents where org_id = public.app_org()))
  with check (public.is_staff() and content_id in (select id from public.contents where org_id = public.app_org()));

create policy shoots_select on public.shoots for select using (public.is_staff() and org_id = public.app_org());
create policy shoots_insert on public.shoots for insert with check (public.is_staff() and org_id = public.app_org());
create policy shoots_update on public.shoots for update using (public.is_staff() and org_id = public.app_org()) with check (org_id = public.app_org());
create policy shoots_delete on public.shoots for delete using (public.is_manager() and org_id = public.app_org());
create policy smem_select on public.shoot_members for select using (public.is_staff() and shoot_id in (select id from public.shoots where org_id = public.app_org()));
create policy smem_write on public.shoot_members for all
  using (public.is_staff() and shoot_id in (select id from public.shoots where org_id = public.app_org()))
  with check (public.is_staff() and shoot_id in (select id from public.shoots where org_id = public.app_org()));
create policy scont_select on public.shoot_contents for select using (public.is_staff() and shoot_id in (select id from public.shoots where org_id = public.app_org()));
create policy scont_write on public.shoot_contents for all
  using (public.is_staff() and shoot_id in (select id from public.shoots where org_id = public.app_org()))
  with check (public.is_staff() and shoot_id in (select id from public.shoots where org_id = public.app_org())
              and content_id in (select id from public.contents where org_id = public.app_org()));

create policy tasks_select on public.tasks for select using (public.is_staff() and org_id = public.app_org());
create policy tasks_insert on public.tasks for insert with check (public.is_staff() and org_id = public.app_org()
  and (content_id is null or content_id in (select id from public.contents)));
create policy tasks_update on public.tasks for update
  using (public.is_staff() and org_id = public.app_org() and (public.is_manager() or assignee_id = auth.uid() or created_by = auth.uid()))
  with check (org_id = public.app_org() and (content_id is null or content_id in (select id from public.contents)));
create policy tasks_delete on public.tasks for delete using (public.is_manager() and org_id = public.app_org());
create policy tsup_select on public.task_supporters for select using (public.is_staff() and task_id in (select id from public.tasks where org_id = public.app_org()));
create policy tsup_write on public.task_supporters for all
  using (public.is_staff() and task_id in (select id from public.tasks where org_id = public.app_org()))
  with check (public.is_staff() and task_id in (select id from public.tasks where org_id = public.app_org()));

create policy events_select on public.events for select using (public.is_staff() and org_id = public.app_org());
create policy events_insert on public.events for insert with check (public.is_staff() and org_id = public.app_org());
create policy events_update on public.events for update using (public.is_staff() and org_id = public.app_org()) with check (org_id = public.app_org());
create policy events_delete on public.events for delete using (org_id = public.app_org() and (public.is_manager() or created_by = auth.uid()));

create policy comments_select on public.comments for select using (public.is_staff() and org_id = public.app_org());
create policy comments_insert on public.comments for insert with check (public.is_staff() and org_id = public.app_org() and author_id = auth.uid());
create policy comments_delete on public.comments for delete using (author_id = auth.uid() or (public.is_manager() and org_id = public.app_org()));

create policy activity_select on public.activity_log for select using (public.is_staff() and org_id = public.app_org());

create policy notif_select on public.notifications for select using (user_id = auth.uid());
create policy notif_update on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy alert_select on public.alert_settings for select using (public.is_staff() and org_id = public.app_org());
create policy alert_write on public.alert_settings for all using (public.is_manager() and org_id = public.app_org()) with check (public.is_manager() and org_id = public.app_org());

-- funções expostas: apenas usuários autenticados
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.bootstrap_organization(text, text), public.ensure_monthly_targets(date), public.today_br() to authenticated;
grant execute on function public.app_org(), public.app_role(), public.is_staff(), public.is_manager(), public.is_admin(), public.client_ids(), public.status_in_approval_flow(uuid) to authenticated;

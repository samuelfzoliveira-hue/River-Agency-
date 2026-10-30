-- RIVER OS — todas as migrações em ordem. Gerado por supabase/bundle.sh; não edite.

-- ══════ migrations/20261101000000_core_schema.sql ══════
-- RIVER OS — Fase 1: esquema principal.
-- Convenções: toda tabela de negócio tem org_id; competência = 1º dia do mês (date).

create extension if not exists pgcrypto;

-- ───────────────────────── Tipos ─────────────────────────
create type public.user_role as enum ('admin', 'gestor', 'social', 'designer', 'videomaker', 'cliente');
create type public.client_status as enum ('ativo', 'pausado', 'encerrado');
create type public.contract_status as enum ('ativo', 'pausado', 'encerrado');
create type public.completion_criterion as enum ('approved', 'scheduled', 'published');
create type public.periodicity as enum ('weekly', 'biweekly', 'monthly');
create type public.deliverable_kind as enum ('content', 'shoot');
create type public.priority as enum ('baixa', 'media', 'alta', 'urgente');
create type public.task_status as enum ('todo', 'doing', 'done', 'cancelled');
create type public.shoot_status as enum ('agendada', 'realizada', 'reagendada', 'cancelada');
create type public.event_kind as enum ('reuniao', 'campanha', 'prazo_aprovacao', 'interno', 'outro');
create type public.unavailability_kind as enum ('ferias', 'folga', 'outro');

-- Data de hoje no fuso da agência (usada em regras de atraso).
create function public.today_br() returns date language sql stable as
  $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- ───────────────────────── Organização e pessoas ─────────────────────────
create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now()
);

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  role public.user_role not null,
  full_name text not null default '',
  email text,
  job_title text,
  specialty text,
  weekly_capacity_hours numeric(5,1) not null default 30 check (weekly_capacity_hours >= 0 and weekly_capacity_hours <= 80),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index profiles_org_idx on public.profiles (org_id);

create table public.invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  email text not null check (email = lower(email)),
  role public.user_role not null,
  full_name text,
  invited_by uuid references auth.users (id) on delete set null,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (org_id, email)
);

create table public.member_unavailability (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  starts_on date not null,
  ends_on date not null,
  kind public.unavailability_kind not null default 'ferias',
  note text,
  check (ends_on >= starts_on)
);
create index member_unavailability_user_idx on public.member_unavailability (user_id, starts_on);

-- ───────────────────────── Catálogos configuráveis ─────────────────────────
create table public.deliverable_types (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  key text not null check (key ~ '^[a-z0-9_]+$'),
  name text not null,
  kind public.deliverable_kind not null default 'content',
  default_hours numeric(5,1) not null default 2,
  position int not null default 0,
  active boolean not null default true,
  unique (org_id, key),
  unique (id, org_id)
);

-- stage: 0 em produção · 1 produzido · 2 aprovado · 3 agendado · 4 publicado
-- deliverable_type_id nulo = etapa padrão; preenchido = etapa específica daquele tipo de projeto.
create table public.pipeline_statuses (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  deliverable_type_id uuid,
  name text not null,
  position int not null,
  stage smallint not null default 0 check (stage between 0 and 4),
  approval_state text check (approval_state in ('aguardando', 'ajustes', 'aprovado')),
  active boolean not null default true,
  unique (id, org_id),
  foreign key (deliverable_type_id, org_id) references public.deliverable_types (id, org_id) on delete cascade
);
create index pipeline_statuses_org_idx on public.pipeline_statuses (org_id, position);

-- ───────────────────────── Clientes e contratos ─────────────────────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  segment text,
  owner_id uuid references public.profiles (user_id) on delete set null,
  status public.client_status not null default 'ativo',
  contract_start date,
  contacts jsonb not null default '[]',
  socials jsonb not null default '{}',
  strategic_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, org_id)
);
create index clients_org_idx on public.clients (org_id, status);

-- Valor mensal em tabela própria: RLS restringe a admin/gestor (segurança por coluna).
create table public.client_financials (
  client_id uuid primary key references public.clients (id) on delete cascade,
  org_id uuid not null references public.organizations (id) on delete cascade,
  monthly_value numeric(12,2) check (monthly_value >= 0)
);

create table public.client_users (
  user_id uuid not null references auth.users (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  primary key (user_id, client_id)
);

create table public.contracts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null,
  name text not null default 'Contrato mensal',
  start_date date not null,
  end_date date,
  status public.contract_status not null default 'ativo',
  completion_criterion public.completion_criterion not null default 'published',
  notes text,
  created_at timestamptz not null default now(),
  check (end_date is null or end_date >= start_date),
  unique (id, org_id),
  foreign key (client_id, org_id) references public.clients (id, org_id) on delete cascade
);
create index contracts_client_idx on public.contracts (client_id, status);

-- Pacote padrão do contrato (usado para gerar as metas de cada mês).
create table public.contract_items (
  id uuid primary key default gen_random_uuid(),
  contract_id uuid not null references public.contracts (id) on delete cascade,
  deliverable_type_id uuid not null references public.deliverable_types (id),
  quantity int not null check (quantity >= 0),
  periodicity public.periodicity not null default 'monthly',
  unique (contract_id, deliverable_type_id)
);

-- Meta por competência. O critério é copiado do contrato na geração: mudar o contrato
-- depois afeta só meses futuros, nunca reescreve o histórico.
create table public.monthly_targets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  contract_id uuid not null references public.contracts (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  competence date not null check (extract(day from competence) = 1),
  deliverable_type_id uuid not null references public.deliverable_types (id),
  quantity int not null check (quantity >= 0),
  periodicity public.periodicity not null default 'monthly',
  completion_criterion public.completion_criterion not null,
  created_at timestamptz not null default now(),
  unique (contract_id, competence, deliverable_type_id)
);
create index monthly_targets_idx on public.monthly_targets (org_id, competence);

-- ───────────────────────── Produção ─────────────────────────
create table public.contents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null,
  contract_id uuid references public.contracts (id) on delete set null,
  competence date not null check (extract(day from competence) = 1),
  deliverable_type_id uuid not null,
  title text not null check (length(trim(title)) > 0),
  objective text,
  briefing text,
  script text,
  status_id uuid not null,
  delivery_stage smallint not null default 0,
  assignee_id uuid references public.profiles (user_id) on delete set null,
  priority public.priority not null default 'media',
  internal_deadline date,
  publish_date date,
  is_extra boolean not null default false,
  cancelled_at timestamptz,
  cancel_reason text,
  checklist jsonb not null default '[]',
  attachments jsonb not null default '[]',
  status_changed_at timestamptz not null default now(),
  approved_at timestamptz,
  approved_by uuid references auth.users (id) on delete set null,
  published_at timestamptz,
  published_late boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients (id, org_id) on delete cascade,
  foreign key (deliverable_type_id, org_id) references public.deliverable_types (id, org_id),
  foreign key (status_id, org_id) references public.pipeline_statuses (id, org_id)
);
create index contents_client_comp_idx on public.contents (client_id, competence);
create index contents_org_status_idx on public.contents (org_id, status_id);
create index contents_assignee_idx on public.contents (assignee_id);

create table public.content_supporters (
  content_id uuid not null references public.contents (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  primary key (content_id, user_id)
);

create table public.shoots (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null,
  title text not null default 'Captação',
  competence date not null check (extract(day from competence) = 1),
  starts_at timestamptz not null,
  duration_minutes int not null default 120 check (duration_minutes > 0),
  location text,
  status public.shoot_status not null default 'agendada',
  is_extra boolean not null default false,
  notes text,
  raw_material_url text,
  equipment_checklist jsonb not null default '[]',
  scene_checklist jsonb not null default '[]',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients (id, org_id) on delete cascade
);
create index shoots_org_start_idx on public.shoots (org_id, starts_at);

create table public.shoot_members (
  shoot_id uuid not null references public.shoots (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  primary key (shoot_id, user_id)
);

create table public.shoot_contents (
  shoot_id uuid not null references public.shoots (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  recorded boolean not null default false,
  primary key (shoot_id, content_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid,
  content_id uuid references public.contents (id) on delete cascade,
  shoot_id uuid references public.shoots (id) on delete set null,
  title text not null check (length(trim(title)) > 0),
  description text,
  assignee_id uuid references public.profiles (user_id) on delete set null,
  status public.task_status not null default 'todo',
  priority public.priority not null default 'media',
  due_date date,
  estimated_hours numeric(5,1) check (estimated_hours is null or estimated_hours >= 0),
  logged_hours numeric(5,1) not null default 0 check (logged_hours >= 0),
  completed_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients (id, org_id) on delete cascade
);
create index tasks_assignee_idx on public.tasks (assignee_id, status);
create index tasks_org_due_idx on public.tasks (org_id, due_date);
create index tasks_content_idx on public.tasks (content_id);

create table public.task_supporters (
  task_id uuid not null references public.tasks (id) on delete cascade,
  user_id uuid not null references public.profiles (user_id) on delete cascade,
  primary key (task_id, user_id)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid,
  kind public.event_kind not null default 'reuniao',
  title text not null check (length(trim(title)) > 0),
  starts_at timestamptz not null,
  ends_at timestamptz,
  notes text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients (id, org_id) on delete cascade
);
create index events_org_start_idx on public.events (org_id, starts_at);

-- ───────────────────────── Comunicação e rastreabilidade ─────────────────────────
create table public.comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null check (entity_type in ('content', 'task', 'client', 'shoot')),
  entity_id uuid not null,
  author_id uuid not null references auth.users (id),
  body text not null check (length(trim(body)) > 0 and length(body) <= 5000),
  mentions uuid[] not null default '{}',
  created_at timestamptz not null default now()
);
create index comments_entity_idx on public.comments (entity_type, entity_id, created_at);

create table public.activity_log (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  client_id uuid,
  actor_id uuid,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index activity_entity_idx on public.activity_log (entity_type, entity_id, created_at desc);
create index activity_client_idx on public.activity_log (client_id, created_at desc);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read_at timestamptz,
  email_sent_at timestamptz, -- reservado para a integração futura por e-mail
  created_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, read_at, created_at desc);

-- Limites de alerta: linha sem cliente/tipo = padrão da agência; mais específica vence.
create table public.alert_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  deliverable_type_id uuid references public.deliverable_types (id) on delete cascade,
  approval_wait_hours int not null default 48 check (approval_wait_hours > 0),
  deadline_warning_days int not null default 2 check (deadline_warning_days >= 0),
  contract_end_warning_days int not null default 30 check (contract_end_warning_days >= 0),
  min_business_days_per_item numeric(4,1) not null default 1 check (min_business_days_per_item > 0),
  unique nulls not distinct (org_id, client_id, deliverable_type_id)
);

-- ══════ migrations/20261101010000_logic_and_security.sql ══════
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

-- ══════ migrations/20261102000000_phase2.sql ══════
-- RIVER OS — Fase 2: aprovação (versões + link seguro), fechamento mensal, banco de mídia.

-- ───────────────────────── Versões e aprovação ─────────────────────────
create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  version int not null,
  caption text not null default '',
  media jsonb not null default '[]', -- [{name,url,kind}] kind: imagem|video|documento
  note text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (content_id, version),
  unique (id, content_id)
);

create function public.content_versions_before() returns trigger language plpgsql as $$
begin
  select coalesce(max(version), 0) + 1 into new.version from public.content_versions where content_id = new.content_id;
  return new;
end $$;
create trigger content_versions_before before insert on public.content_versions for each row execute function public.content_versions_before();

-- O token nunca é guardado: só o hash SHA-256. O link completo é exibido uma única vez a quem o gerou.
create table public.approval_links (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  version_id uuid not null,
  token_hash text not null unique,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (version_id, content_id) references public.content_versions (id, content_id) on delete cascade
);
create index approval_links_content_idx on public.approval_links (content_id);

create table public.approval_events (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  content_id uuid not null references public.contents (id) on delete cascade,
  version int,
  action text not null check (action in ('enviado', 'aprovado', 'ajustes')),
  comment text check (comment is null or length(comment) <= 2000),
  actor_name text,
  actor_user uuid references auth.users (id) on delete set null,
  via text not null check (via in ('link', 'portal', 'interno')),
  created_at timestamptz not null default now()
);
create index approval_events_content_idx on public.approval_events (content_id, created_at);

-- ───────────────────────── Fechamento mensal ─────────────────────────
create table public.month_closings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null references public.clients (id) on delete cascade,
  competence date not null check (extract(day from competence) = 1),
  status text not null default 'fechado' check (status in ('fechado', 'reaberto')),
  snapshot jsonb not null,   -- cumprimento no instante do fechamento (linhas por tipo, totais)
  pending jsonb not null default '[]', -- pendências transferidas; mantêm a competência original
  notes text,
  closed_by uuid references auth.users (id) on delete set null,
  closed_at timestamptz not null default now(),
  reopen_log jsonb not null default '[]', -- [{at, by, reason}]
  unique (client_id, competence)
);

-- ───────────────────────── Banco de mídia (links; pronto para Google Drive) ─────────────────────────
create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  client_id uuid not null,
  name text not null check (length(trim(name)) > 0),
  url text not null check (url ~* '^https?://'),
  kind text not null default 'outro' check (kind in ('imagem', 'video', 'documento', 'outro')),
  campaign text,
  captured_on date,
  shoot_id uuid references public.shoots (id) on delete set null,
  content_id uuid references public.contents (id) on delete set null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (client_id, org_id) references public.clients (id, org_id) on delete cascade
);
create index media_assets_client_idx on public.media_assets (client_id, captured_on desc);

-- ───────────────────────── RLS ─────────────────────────
alter table public.content_versions enable row level security;
alter table public.approval_links enable row level security;
alter table public.approval_events enable row level security;
alter table public.month_closings enable row level security;
alter table public.media_assets enable row level security;
revoke all on public.content_versions, public.approval_links, public.approval_events, public.month_closings, public.media_assets from anon;

create policy versions_select on public.content_versions for select using (public.is_staff() and org_id = public.app_org());
create policy versions_insert on public.content_versions for insert with check (public.is_staff() and org_id = public.app_org()
  and content_id in (select id from public.contents));
-- links: só a equipe vê (sem o token) e revoga; criação e uso passam pelas funções abaixo
create policy links_select on public.approval_links for select using (public.is_staff() and org_id = public.app_org());
create policy events_a_select on public.approval_events for select using (
  (public.is_staff() and org_id = public.app_org()) or content_id in (select id from public.contents));
create policy closings_select on public.month_closings for select using (public.is_staff() and org_id = public.app_org());
create policy media_select on public.media_assets for select using (public.is_staff() and org_id = public.app_org());
create policy media_insert on public.media_assets for insert with check (public.is_staff() and org_id = public.app_org() and created_by = auth.uid());
create policy media_update on public.media_assets for update using (org_id = public.app_org() and (public.is_manager() or created_by = auth.uid())) with check (org_id = public.app_org());
create policy media_delete on public.media_assets for delete using (org_id = public.app_org() and (public.is_manager() or created_by = auth.uid()));

-- ───────────────────────── Fechamento: funções ─────────────────────────
create function public.close_month(p_client uuid, p_competence date, p_snapshot jsonb, p_pending jsonb, p_notes text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_org uuid := public.app_org(); v_id uuid; v_status text;
begin
  if not public.is_manager() then raise exception 'sem permissão'; end if;
  if not exists (select 1 from public.clients where id = p_client and org_id = v_org) then raise exception 'cliente não encontrado'; end if;
  if extract(day from p_competence) <> 1 then raise exception 'competência inválida'; end if;
  if p_competence >= date_trunc('month', public.today_br())::date + interval '1 month' then raise exception 'não é possível fechar um mês futuro'; end if;
  select id, status into v_id, v_status from public.month_closings where client_id = p_client and competence = p_competence;
  if v_status = 'fechado' then raise exception 'este mês já está fechado; peça ao administrador para reabrir'; end if;
  if v_id is null then
    insert into public.month_closings (org_id, client_id, competence, snapshot, pending, notes, closed_by)
      values (v_org, p_client, p_competence, p_snapshot, coalesce(p_pending, '[]'), nullif(trim(p_notes), ''), auth.uid()) returning id into v_id;
  else
    update public.month_closings set status = 'fechado', snapshot = p_snapshot, pending = coalesce(p_pending, '[]'), notes = nullif(trim(p_notes), ''),
      closed_by = auth.uid(), closed_at = now() where id = v_id;
  end if;
  insert into public.activity_log (org_id, entity_type, entity_id, client_id, actor_id, action, details)
    values (v_org, 'closing', v_id, p_client, auth.uid(), 'fechamento', jsonb_build_object('competencia', p_competence));
  return v_id;
end $$;

create function public.reopen_month(p_closing uuid, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare c public.month_closings;
begin
  if not public.is_admin() then raise exception 'apenas administradores reabrem fechamentos'; end if;
  if length(trim(coalesce(p_reason, ''))) < 5 then raise exception 'informe a justificativa (mínimo 5 caracteres)'; end if;
  select * into c from public.month_closings where id = p_closing and org_id = public.app_org();
  if not found then raise exception 'fechamento não encontrado'; end if;
  if c.status <> 'fechado' then raise exception 'o mês não está fechado'; end if;
  update public.month_closings set status = 'reaberto',
    reopen_log = reopen_log || jsonb_build_object('at', now(), 'by', auth.uid(), 'reason', trim(p_reason)) where id = p_closing;
  insert into public.activity_log (org_id, entity_type, entity_id, client_id, actor_id, action, details)
    values (c.org_id, 'closing', c.id, c.client_id, auth.uid(), 'reabertura', jsonb_build_object('competencia', c.competence, 'justificativa', trim(p_reason)));
end $$;

-- mês fechado: metas ficam travadas (reabra para alterar). Inserções automáticas de meses fechados são ignoradas.
create function public.guard_closed_targets() returns trigger language plpgsql security definer set search_path = public as $$
declare r public.monthly_targets := case when tg_op = 'DELETE' then old else new end;
begin
  if exists (select 1 from public.month_closings where client_id = r.client_id and competence = r.competence and status = 'fechado') then
    if tg_op = 'INSERT' then return null; end if;
    raise exception 'mês fechado: reabra o fechamento para alterar as metas';
  end if;
  return r;
end $$;
create trigger guard_closed_targets before insert or update or delete on public.monthly_targets for each row execute function public.guard_closed_targets();

-- ───────────────────────── Aprovação: funções ─────────────────────────
create function public._status_for(p_content uuid, p_state text) returns uuid
language sql stable security definer set search_path = public as $$
  select s.id from public.pipeline_statuses s join public.contents c on c.id = p_content
  where s.org_id = c.org_id and s.active and s.approval_state = p_state and (p_state <> 'aprovado' or s.stage = 2)
    and (s.deliverable_type_id is null or s.deliverable_type_id = c.deliverable_type_id)
  order by (s.deliverable_type_id is null), s.position limit 1 $$;

create function public._approval_payload(p_content uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'content_id', c.id, 'title', c.title, 'client_name', cl.name, 'type_name', t.name,
    'state', coalesce(s.approval_state, 'indisponivel'),
    'version', v.version, 'caption', v.caption, 'media', v.media, 'note', v.note, 'sent_at', v.created_at,
    'events', coalesce((select jsonb_agg(jsonb_build_object('action', e.action, 'comment', e.comment, 'actor_name', e.actor_name, 'version', e.version, 'created_at', e.created_at) order by e.created_at)
                        from public.approval_events e where e.content_id = c.id), '[]'))
  from public.contents c join public.clients cl on cl.id = c.client_id join public.deliverable_types t on t.id = c.deliverable_type_id
  join public.pipeline_statuses s on s.id = c.status_id
  left join lateral (select * from public.content_versions where content_id = c.id order by version desc limit 1) v on true
  where c.id = p_content $$;

create function public._apply_decision(p_content uuid, p_action text, p_comment text, p_name text, p_via text, p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.contents; v_status uuid; v_version int;
begin
  select * into c from public.contents where id = p_content for update;
  v_status := public._status_for(p_content, case p_action when 'aprovado' then 'aprovado' else 'ajustes' end);
  if v_status is null then raise exception 'etapa de % não configurada', p_action; end if;
  select max(version) into v_version from public.content_versions where content_id = p_content;
  insert into public.approval_events (org_id, content_id, version, action, comment, actor_name, actor_user, via)
    values (c.org_id, p_content, v_version, p_action, nullif(trim(p_comment), ''), p_name, p_user, p_via);
  update public.contents set status_id = v_status where id = p_content;
  perform public.push_notification(c.org_id, c.assignee_id, case p_action when 'aprovado' then 'cliente_aprovou' else 'cliente_ajustes' end,
    case p_action when 'aprovado' then 'Cliente aprovou: ' else 'Cliente pediu ajustes: ' end || c.title,
    left(coalesce(p_comment, ''), 140), '/conteudos/' || c.id);
end $$;

create function public.approval_view(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l public.approval_links; p jsonb;
begin
  select * into l from public.approval_links where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');
  if not found or l.revoked_at is not null then return null; end if;
  p := public._approval_payload(l.content_id);
  if l.expires_at < now() then return jsonb_build_object('expired', true, 'title', p->>'title', 'client_name', p->>'client_name'); end if;
  -- o link vale para a versão enviada; se houver versão mais nova, o cliente deve receber outro link
  if (p->>'version')::int is distinct from (select version from public.content_versions where id = l.version_id) then
    return jsonb_build_object('superseded', true, 'title', p->>'title', 'client_name', p->>'client_name');
  end if;
  return p || jsonb_build_object('expired', false, 'expires_at', l.expires_at);
end $$;

create function public.approval_decide(p_token text, p_action text, p_comment text, p_name text) returns void
language plpgsql security definer set search_path = public as $$
declare l public.approval_links; p jsonb;
begin
  if p_action not in ('aprovado', 'ajustes') then raise exception 'ação inválida'; end if;
  if length(trim(coalesce(p_name, ''))) < 2 or length(p_name) > 80 then raise exception 'informe seu nome'; end if;
  if length(coalesce(p_comment, '')) > 2000 then raise exception 'comentário muito longo'; end if;
  if p_action = 'ajustes' and length(trim(coalesce(p_comment, ''))) < 3 then raise exception 'descreva os ajustes desejados'; end if;
  select * into l from public.approval_links where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex') for update;
  if not found or l.revoked_at is not null then raise exception 'link inválido'; end if;
  if l.expires_at < now() then raise exception 'link expirado; peça um novo à agência'; end if;
  p := public._approval_payload(l.content_id);
  if (p->>'version')::int is distinct from (select version from public.content_versions where id = l.version_id) then raise exception 'existe uma versão mais recente; peça um novo link'; end if;
  if p->>'state' <> 'aguardando' then raise exception 'este conteúdo não está aguardando aprovação'; end if;
  perform public._apply_decision(l.content_id, p_action, p_comment, trim(p_name), 'link', null);
end $$;

-- envio para aprovação (equipe): move para a etapa "aguardando", revoga links antigos e registra o novo link
create function public.request_approval(p_content uuid, p_token_hash text, p_expires timestamptz) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.contents; v public.content_versions; v_status uuid; v_link uuid;
begin
  if not public.is_staff() then raise exception 'sem permissão'; end if;
  select * into c from public.contents where id = p_content and org_id = public.app_org();
  if not found then raise exception 'conteúdo não encontrado'; end if;
  select * into v from public.content_versions where content_id = p_content order by version desc limit 1;
  if not found then raise exception 'crie uma versão (legenda e prévia) antes de enviar'; end if;
  v_status := public._status_for(p_content, 'aguardando');
  if v_status is null then raise exception 'etapa "aguardando aprovação" não configurada'; end if;
  if p_expires <= now() then raise exception 'validade inválida'; end if;
  update public.approval_links set revoked_at = now() where content_id = p_content and revoked_at is null;
  insert into public.approval_links (org_id, content_id, version_id, token_hash, expires_at, created_by)
    values (c.org_id, p_content, v.id, p_token_hash, p_expires, auth.uid()) returning id into v_link;
  insert into public.approval_events (org_id, content_id, version, action, actor_name, actor_user, via)
    values (c.org_id, p_content, v.version, 'enviado', (select full_name from public.profiles where user_id = auth.uid()), auth.uid(), 'interno');
  update public.contents set status_id = v_status where id = p_content;
  return v_link;
end $$;

-- portal do cliente autenticado
create function public.approval_view_portal(p_content uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not exists (select 1 from public.contents where id = p_content and client_id in (select public.client_ids())) then return null; end if;
  return public._approval_payload(p_content);
end $$;

create function public.approval_decide_portal(p_content uuid, p_action text, p_comment text) returns void
language plpgsql security definer set search_path = public as $$
declare p jsonb; v_name text;
begin
  if p_action not in ('aprovado', 'ajustes') then raise exception 'ação inválida'; end if;
  if not exists (select 1 from public.contents where id = p_content and client_id in (select public.client_ids())) then raise exception 'sem permissão'; end if;
  if p_action = 'ajustes' and length(trim(coalesce(p_comment, ''))) < 3 then raise exception 'descreva os ajustes desejados'; end if;
  p := public._approval_payload(p_content);
  if p->>'state' <> 'aguardando' then raise exception 'este conteúdo não está aguardando aprovação'; end if;
  select coalesce(nullif(full_name, ''), email) into v_name from public.profiles where user_id = auth.uid();
  perform public._apply_decision(p_content, p_action, p_comment, v_name, 'portal', auth.uid());
end $$;

-- lista do portal: o papel "cliente" não lê pipeline_statuses, então nome/estado da etapa vêm por aqui
create function public.portal_contents() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', c.id, 'title', c.title, 'publish_date', c.publish_date, 'status', s.name, 'approval_state', s.approval_state)
                            order by c.publish_date nulls last, c.created_at), '[]'::jsonb)
  from public.contents c join public.pipeline_statuses s on s.id = c.status_id
  where c.client_id in (select public.client_ids()) and c.cancelled_at is null and s.approval_state is not null $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.portal_contents() to authenticated;
grant execute on function public.bootstrap_organization(text, text), public.ensure_monthly_targets(date), public.today_br(),
  public.app_org(), public.app_role(), public.is_staff(), public.is_manager(), public.is_admin(), public.client_ids(), public.status_in_approval_flow(uuid),
  public.close_month(uuid, date, jsonb, jsonb, text), public.reopen_month(uuid, text), public.request_approval(uuid, text, timestamptz),
  public.approval_view_portal(uuid), public.approval_decide_portal(uuid, text, text) to authenticated;
-- únicas funções chamáveis sem login: o cliente que recebeu o link
grant execute on function public.approval_view(text), public.approval_decide(text, text, text, text) to anon, authenticated;

-- ───────────────────────── Convite de usuário-cliente (portal) ─────────────────────────
alter table public.invites add column client_id uuid references public.clients (id) on delete cascade;
alter table public.invites add constraint invites_client_role check (client_id is null or role = 'cliente');

create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
declare v_inv public.invites;
begin
  select * into v_inv from public.invites where email = lower(new.email) and accepted_at is null order by created_at limit 1;
  if found then
    insert into public.profiles (user_id, org_id, role, full_name, email)
    values (new.id, v_inv.org_id, v_inv.role,
            coalesce(nullif(new.raw_user_meta_data->>'full_name', ''), v_inv.full_name, split_part(new.email, '@', 1)),
            lower(new.email));
    if v_inv.client_id is not null then insert into public.client_users (user_id, client_id) values (new.id, v_inv.client_id); end if;
    update public.invites set accepted_at = now() where id = v_inv.id;
  end if;
  return new;
end $$;

drop policy invites_insert on public.invites;
create policy invites_insert on public.invites for insert with check (
  public.is_manager() and org_id = public.app_org() and (role <> 'admin' or public.is_admin())
  and (client_id is null or client_id in (select id from public.clients where org_id = public.app_org())));

-- ══════ migrations/20261103000000_phase3.sql ══════
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

-- ══════ migrations/20261104000000_time_tracking.sql ══════
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

-- ══════ migrations/20261105000000_storage.sql ══════
-- RIVER OS — upload direto de arquivos (Supabase Storage). Caminho: <org_id>/<client_id>/<uuid>-<nome>.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('media', 'media', false, 52428800, array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm', 'application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

-- A equipe só enxerga e envia arquivos da própria agência, dentro da pasta de um cliente existente dela.
create policy media_obj_select on storage.objects for select to authenticated
  using (bucket_id = 'media' and public.is_staff() and (storage.foldername(name))[1] = public.app_org()::text);
create policy media_obj_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and public.is_staff() and (storage.foldername(name))[1] = public.app_org()::text
    and exists (select 1 from public.clients c where c.id::text = (storage.foldername(objects.name))[2]));
create policy media_obj_delete on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = public.app_org()::text and (public.is_manager() or owner_id = auth.uid()::text or owner = auth.uid()));

-- banco de mídia: link OU arquivo
alter table public.media_assets add column storage_path text;
alter table public.media_assets add column size_bytes bigint;
alter table public.media_assets alter column url drop not null;
alter table public.media_assets add constraint media_source check ((url is not null) <> (storage_path is not null));
alter table public.media_assets add constraint media_path_org check (storage_path is null or storage_path like org_id::text || '/' || client_id::text || '/%');

-- link de aprovação guarda URLs assinadas das prévias enviadas por arquivo (o cliente não tem acesso ao Storage)
alter table public.approval_links add column media_snapshot jsonb;

drop function public.request_approval(uuid, text, timestamptz);
create function public.request_approval(p_content uuid, p_token_hash text, p_expires timestamptz, p_media jsonb default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare c public.contents; v public.content_versions; v_status uuid; v_link uuid;
begin
  if not public.is_staff() then raise exception 'sem permissão'; end if;
  select * into c from public.contents where id = p_content and org_id = public.app_org();
  if not found then raise exception 'conteúdo não encontrado'; end if;
  select * into v from public.content_versions where content_id = p_content order by version desc limit 1;
  if not found then raise exception 'crie uma versão (legenda e prévia) antes de enviar'; end if;
  v_status := public._status_for(p_content, 'aguardando');
  if v_status is null then raise exception 'etapa "aguardando aprovação" não configurada'; end if;
  if p_expires <= now() then raise exception 'validade inválida'; end if;
  update public.approval_links set revoked_at = now() where content_id = p_content and revoked_at is null;
  insert into public.approval_links (org_id, content_id, version_id, token_hash, expires_at, created_by, media_snapshot)
    values (c.org_id, p_content, v.id, p_token_hash, p_expires, auth.uid(), p_media) returning id into v_link;
  insert into public.approval_events (org_id, content_id, version, action, actor_name, actor_user, via)
    values (c.org_id, p_content, v.version, 'enviado', (select full_name from public.profiles where user_id = auth.uid()), auth.uid(), 'interno');
  update public.contents set status_id = v_status where id = p_content;
  return v_link;
end $$;

-- as prévias exibidas ao cliente vêm do snapshot do link (URLs assinadas) quando existir
create or replace function public.approval_view(p_token text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l public.approval_links; p jsonb;
begin
  select * into l from public.approval_links where token_hash = encode(sha256(convert_to(coalesce(p_token, ''), 'utf8')), 'hex');
  if not found or l.revoked_at is not null then return null; end if;
  p := public._approval_payload(l.content_id);
  if l.expires_at < now() then return jsonb_build_object('expired', true, 'title', p->>'title', 'client_name', p->>'client_name'); end if;
  if (p->>'version')::int is distinct from (select version from public.content_versions where id = l.version_id) then
    return jsonb_build_object('superseded', true, 'title', p->>'title', 'client_name', p->>'client_name');
  end if;
  return p || jsonb_build_object('expired', false, 'expires_at', l.expires_at, 'media', coalesce(l.media_snapshot, p->'media'));
end $$;

create or replace function public.approval_view_portal(p_content uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p jsonb; l public.approval_links;
begin
  if not exists (select 1 from public.contents where id = p_content and client_id in (select public.client_ids())) then return null; end if;
  p := public._approval_payload(p_content);
  select l2.* into l from public.approval_links l2 join public.content_versions v on v.id = l2.version_id
    where l2.content_id = p_content and l2.revoked_at is null and l2.expires_at > now() and v.version = (p->>'version')::int and l2.media_snapshot is not null
    order by l2.created_at desc limit 1;
  if found then p := p || jsonb_build_object('media', l.media_snapshot); end if;
  return p;
end $$;

revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.bootstrap_organization(text, text), public.ensure_monthly_targets(date), public.today_br(),
  public.app_org(), public.app_role(), public.is_staff(), public.is_manager(), public.is_admin(), public.client_ids(), public.status_in_approval_flow(uuid),
  public.close_month(uuid, date, jsonb, jsonb, text), public.reopen_month(uuid, text), public.request_approval(uuid, text, timestamptz, jsonb),
  public.approval_view_portal(uuid), public.approval_decide_portal(uuid, text, text), public.portal_contents(),
  public.run_automations(uuid, boolean), public.start_timer(uuid), public.stop_timer(), public.add_time_entry(uuid, int, date, text) to authenticated;
grant execute on function public.approval_view(text), public.approval_decide(text, text, text, text) to anon, authenticated;
grant execute on function public.email_queue(int), public.email_mark_sent(uuid[]), public.run_automations(uuid, boolean) to service_role;

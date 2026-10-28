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

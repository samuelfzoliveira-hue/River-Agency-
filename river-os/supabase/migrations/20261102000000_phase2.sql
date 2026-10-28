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

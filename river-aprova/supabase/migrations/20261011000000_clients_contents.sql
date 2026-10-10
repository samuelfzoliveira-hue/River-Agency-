-- River Aprova — etapa 2: clientes, conteúdos, versões, aprovação, notificações e storage.
-- Toda escrita sensível passa por funções SECURITY DEFINER que validam o papel do usuário.

create type public.content_type as enum ('flyer', 'carrossel', 'reels');
create type public.content_status as enum ('aguardando', 'aprovado', 'ajuste_solicitado', 'publicado');
create type public.media_type as enum ('imagem', 'video', 'capa');
create type public.approval_action as enum ('aprovado', 'ajuste_solicitado', 'reaberto');

alter table public.profiles add column if not exists must_change_password boolean not null default false;

-- ───────── Tabelas ─────────
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users (id) on delete cascade,
  nome_marca text not null check (length(trim(nome_marca)) > 0),
  instagram text not null check (instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  foto_perfil text,
  bio text,
  created_at timestamptz not null default now()
);

create table public.contents (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  tipo public.content_type not null,
  status public.content_status not null default 'aguardando',
  data_publicacao date,
  prazo_aprovacao timestamptz,
  ordem_feed integer not null default 0,
  ja_publicado boolean not null default false,
  versao_atual integer not null default 1,
  created_at timestamptz not null default now()
);
create index contents_client_status_idx on public.contents (client_id, status);

create table public.content_versions (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents (id) on delete cascade,
  numero_versao integer not null,
  legenda text not null default '',
  created_at timestamptz not null default now(),
  unique (content_id, numero_versao)
);

-- `url` guarda o caminho do arquivo no bucket privado (nunca uma URL pública).
create table public.content_media (
  id uuid primary key default gen_random_uuid(),
  version_id uuid not null references public.content_versions (id) on delete cascade,
  tipo public.media_type not null,
  url text not null,
  ordem integer not null default 0
);
create index content_media_version_idx on public.content_media (version_id);

create table public.approval_log (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.contents (id) on delete cascade,
  numero_versao integer not null,
  user_id uuid not null references auth.users (id),
  acao public.approval_action not null,
  comentario text check (comentario is null or length(comentario) <= 2000),
  slide_referencia integer,
  tempo_video_referencia text,
  notified boolean not null default false,
  created_at timestamptz not null default now()
);
create index approval_log_content_idx on public.approval_log (content_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  tipo text not null,
  titulo text not null,
  mensagem text,
  content_id uuid references public.contents (id) on delete cascade,
  client_id uuid references public.clients (id) on delete cascade,
  lida boolean not null default false,
  created_at timestamptz not null default now()
);

alter table public.clients enable row level security;
alter table public.contents enable row level security;
alter table public.content_versions enable row level security;
alter table public.content_media enable row level security;
alter table public.approval_log enable row level security;
alter table public.notifications enable row level security;

revoke all on public.clients, public.contents, public.content_versions, public.content_media,
  public.approval_log, public.notifications from anon;

-- ───────── Funções auxiliares de acesso ─────────
create or replace function public.owns_client(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.clients where id = cid and user_id = auth.uid());
$$;

create or replace function public.can_read_content(cid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin() or exists (
    select 1 from public.contents c join public.clients cl on cl.id = c.client_id
    where c.id = cid and cl.user_id = auth.uid());
$$;

create or replace function public.can_read_version(vid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.content_versions v
                 where v.id = vid and public.can_read_content(v.content_id));
$$;

revoke all on function public.owns_client(uuid), public.can_read_content(uuid), public.can_read_version(uuid)
  from public, anon;
grant execute on function public.owns_client(uuid), public.can_read_content(uuid), public.can_read_version(uuid)
  to authenticated;

-- ───────── Políticas RLS ─────────
create policy clients_admin_all on public.clients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy clients_own_select on public.clients for select to authenticated
  using (user_id = auth.uid());

create policy contents_admin_all on public.contents for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy contents_client_select on public.contents for select to authenticated
  using (public.owns_client(client_id));

create policy versions_admin_all on public.content_versions for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy versions_client_select on public.content_versions for select to authenticated
  using (public.can_read_content(content_id));

create policy media_admin_all on public.content_media for all to authenticated
  using (public.is_admin()) with check (public.is_admin());
create policy media_client_select on public.content_media for select to authenticated
  using (public.can_read_version(version_id));

-- Log de aprovação é imutável: só leitura (a escrita é feita pelas funções abaixo).
create policy log_admin_select on public.approval_log for select to authenticated
  using (public.is_admin());
create policy log_client_select on public.approval_log for select to authenticated
  using (public.can_read_content(content_id));
revoke insert, update, delete on public.approval_log from authenticated;

-- Notificações: só o admin lê e marca como lida; criação apenas pelas funções.
create policy notifications_admin_select on public.notifications for select to authenticated
  using (public.is_admin());
create policy notifications_admin_update on public.notifications for update to authenticated
  using (public.is_admin()) with check (public.is_admin());
revoke insert, update, delete on public.notifications from authenticated;
grant update (lida) on public.notifications to authenticated;

-- ───────── Validação de mídias (interna) ─────────
create or replace function public.validate_media(p_client uuid, p_tipo public.content_type, p_media jsonb)
returns void language plpgsql set search_path = public as $$
declare n_img int; n_vid int; n_cap int; bad int;
begin
  if p_media is null or jsonb_typeof(p_media) <> 'array' then
    raise exception 'Mídias inválidas';
  end if;
  select count(*) filter (where m ->> 'tipo' = 'imagem'),
         count(*) filter (where m ->> 'tipo' = 'video'),
         count(*) filter (where m ->> 'tipo' = 'capa'),
         count(*) filter (where coalesce(m ->> 'url', '') = ''
                            or (m ->> 'url') not like p_client::text || '/%'
                            or (m ->> 'url') like '%..%'
                            or coalesce(m ->> 'tipo', '') not in ('imagem', 'video', 'capa'))
    into n_img, n_vid, n_cap, bad
    from jsonb_array_elements(p_media) m;
  if bad > 0 then raise exception 'Arquivo inválido para este cliente'; end if;
  if p_tipo = 'flyer' and not (n_img = 1 and n_vid = 0 and n_cap = 0) then
    raise exception 'Flyer exige exatamente 1 imagem';
  elsif p_tipo = 'carrossel' and not (n_img between 2 and 20 and n_vid = 0 and n_cap = 0) then
    raise exception 'Carrossel exige de 2 a 20 imagens';
  elsif p_tipo = 'reels' and not (n_vid = 1 and n_cap = 1 and n_img = 0) then
    raise exception 'Reels exige 1 vídeo e 1 imagem de capa';
  end if;
end;
$$;

create or replace function public.insert_media(p_version uuid, p_media jsonb)
returns void language sql set search_path = public as $$
  insert into public.content_media (version_id, tipo, url, ordem)
  select p_version, (m ->> 'tipo')::public.media_type, m ->> 'url', (ord - 1)::int
  from jsonb_array_elements(p_media) with ordinality t(m, ord);
$$;

revoke all on function public.validate_media(uuid, public.content_type, jsonb),
  public.insert_media(uuid, jsonb) from public, anon, authenticated;

-- ───────── Ações do admin ─────────
create or replace function public.create_content(
  p_client uuid, p_tipo public.content_type, p_data date, p_prazo timestamptz,
  p_ja_publicado boolean, p_legenda text, p_media jsonb)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_ver uuid;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  if not exists (select 1 from public.clients where id = p_client) then
    raise exception 'Cliente não encontrado';
  end if;
  if not coalesce(p_ja_publicado, false) and (p_data is null or p_prazo is null) then
    raise exception 'Informe a data de publicação e o prazo de aprovação';
  end if;
  perform public.validate_media(p_client, p_tipo, p_media);

  insert into public.contents (client_id, tipo, status, data_publicacao, prazo_aprovacao, ordem_feed, ja_publicado)
  values (p_client, p_tipo,
          case when coalesce(p_ja_publicado, false) then 'publicado'::public.content_status
               else 'aguardando'::public.content_status end,
          p_data,
          case when coalesce(p_ja_publicado, false) then null else p_prazo end,
          case when p_data is null then 0 else -(p_data - date '2020-01-01') end,
          coalesce(p_ja_publicado, false))
  returning id into v_id;

  insert into public.content_versions (content_id, numero_versao, legenda)
  values (v_id, 1, coalesce(p_legenda, '')) returning id into v_ver;
  perform public.insert_media(v_ver, p_media);
  return v_id;
end;
$$;

-- Nova versão: só quando há ajuste solicitado. Mídias/legenda omitidas são copiadas da versão atual.
create or replace function public.create_content_version(p_content uuid, p_legenda text, p_media jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare c public.contents; v_new int; v_ver uuid; v_old uuid; v_leg text;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into c from public.contents where id = p_content for update;
  if not found then raise exception 'Conteúdo não encontrado'; end if;
  if c.status <> 'ajuste_solicitado' then
    raise exception 'Só é possível enviar nova versão quando há ajuste solicitado';
  end if;
  select id, legenda into v_old, v_leg from public.content_versions
    where content_id = c.id and numero_versao = c.versao_atual;
  v_new := c.versao_atual + 1;
  insert into public.content_versions (content_id, numero_versao, legenda)
  values (c.id, v_new, coalesce(p_legenda, v_leg, '')) returning id into v_ver;

  if p_media is null or jsonb_typeof(p_media) <> 'array' or jsonb_array_length(p_media) = 0 then
    insert into public.content_media (version_id, tipo, url, ordem)
      select v_ver, tipo, url, ordem from public.content_media where version_id = v_old;
  else
    perform public.validate_media(c.client_id, c.tipo, p_media);
    perform public.insert_media(v_ver, p_media);
  end if;
  update public.contents set versao_atual = v_new, status = 'aguardando' where id = c.id;
  return v_new;
end;
$$;

create or replace function public.reopen_content(p_content uuid, p_comentario text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.contents;
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  select * into c from public.contents where id = p_content for update;
  if not found then raise exception 'Conteúdo não encontrado'; end if;
  if c.status <> 'aprovado' then raise exception 'Só conteúdos aprovados podem ser reabertos'; end if;
  insert into public.approval_log (content_id, numero_versao, user_id, acao, comentario, notified)
  values (c.id, c.versao_atual, auth.uid(), 'reaberto', nullif(left(trim(coalesce(p_comentario, '')), 2000), ''), true);
  update public.contents set status = 'aguardando' where id = c.id;
end;
$$;

create or replace function public.mark_published(p_content uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.contents set status = 'publicado' where id = p_content and status = 'aprovado';
  if not found then raise exception 'Só conteúdos aprovados podem ser marcados como publicados'; end if;
end;
$$;

create or replace function public.reorder_feed(p_client uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Acesso negado'; end if;
  update public.contents c set ordem_feed = t.ord::int
  from unnest(p_ids) with ordinality t(id, ord)
  where c.id = t.id and c.client_id = p_client and c.status <> 'publicado';
end;
$$;

-- ───────── Decisão do cliente ─────────
create or replace function public.decide_content(
  p_content uuid, p_acao public.approval_action, p_comentario text, p_slide integer, p_tempo text)
returns void language plpgsql security definer set search_path = public as $$
declare c public.contents; cl public.clients; v_comment text; v_imgs int; v_tempo text;
begin
  select * into c from public.contents where id = p_content for update;
  if not found then raise exception 'Conteúdo não encontrado'; end if;
  select * into cl from public.clients where id = c.client_id;
  if cl.user_id is distinct from auth.uid() then raise exception 'Acesso negado'; end if;
  if p_acao not in ('aprovado', 'ajuste_solicitado') then raise exception 'Ação inválida'; end if;
  if c.status <> 'aguardando' then
    raise exception 'Este conteúdo não está aguardando aprovação';
  end if;

  v_comment := nullif(left(trim(coalesce(p_comentario, '')), 2000), '');
  if p_acao = 'ajuste_solicitado' and v_comment is null then
    raise exception 'Escreva um comentário descrevendo o ajuste';
  end if;

  if p_slide is not null then
    select count(*) into v_imgs from public.content_media m
      join public.content_versions v on v.id = m.version_id
      where v.content_id = c.id and v.numero_versao = c.versao_atual and m.tipo = 'imagem';
    if c.tipo <> 'carrossel' or p_slide < 1 or p_slide > v_imgs then
      raise exception 'Slide inválido';
    end if;
  end if;
  v_tempo := nullif(trim(coalesce(p_tempo, '')), '');
  if v_tempo is not null and (c.tipo <> 'reels' or v_tempo !~ '^[0-9]{1,3}:[0-5][0-9]$') then
    raise exception 'Tempo inválido (use minuto:segundo)';
  end if;

  insert into public.approval_log
    (content_id, numero_versao, user_id, acao, comentario, slide_referencia, tempo_video_referencia)
  values (c.id, c.versao_atual, auth.uid(), p_acao, v_comment, p_slide, v_tempo);

  update public.contents
    set status = case when p_acao = 'aprovado' then 'aprovado'::public.content_status
                      else 'ajuste_solicitado'::public.content_status end
    where id = c.id;

  insert into public.notifications (tipo, titulo, mensagem, content_id, client_id)
  values ('decisao',
          cl.nome_marca || (case when p_acao = 'aprovado' then ' aprovou um conteúdo'
                                 else ' solicitou ajuste' end),
          coalesce(v_comment, ''), c.id, cl.id);
end;
$$;

-- ───────── Troca obrigatória de senha ─────────
create or replace function public.complete_password_change()
returns void language sql security definer set search_path = public as $$
  update public.profiles set must_change_password = false where id = auth.uid();
$$;

revoke all on function
  public.create_content(uuid, public.content_type, date, timestamptz, boolean, text, jsonb),
  public.create_content_version(uuid, text, jsonb),
  public.reopen_content(uuid, text),
  public.mark_published(uuid),
  public.reorder_feed(uuid, uuid[]),
  public.decide_content(uuid, public.approval_action, text, integer, text),
  public.complete_password_change()
  from public, anon;
grant execute on function
  public.create_content(uuid, public.content_type, date, timestamptz, boolean, text, jsonb),
  public.create_content_version(uuid, text, jsonb),
  public.reopen_content(uuid, text),
  public.mark_published(uuid),
  public.reorder_feed(uuid, uuid[]),
  public.decide_content(uuid, public.approval_action, text, integer, text),
  public.complete_password_change()
  to authenticated;

-- ───────── Storage: bucket privado, cada cliente só lê a própria pasta ─────────
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('media', 'media', false, 524288000,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/quicktime', 'video/webm'])
  on conflict (id) do update
    set public = false, file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types;
exception when others then
  -- Plano gratuito do Supabase limita arquivos a 50 MB: cria o bucket sem limite próprio.
  insert into storage.buckets (id, name, public) values ('media', 'media', false)
  on conflict (id) do update set public = false;
end $$;

create policy media_objects_admin_all on storage.objects for all to authenticated
  using (bucket_id = 'media' and public.is_admin())
  with check (bucket_id = 'media' and public.is_admin());

-- Pasta = id do cliente (primeiro segmento do caminho).
create policy media_objects_client_read on storage.objects for select to authenticated
  using (bucket_id = 'media' and exists (
    select 1 from public.clients c
    where c.user_id = auth.uid() and c.id::text = (storage.foldername(name))[1]));

-- ───────── Tempo real do sino de notificações ─────────
do $$
begin
  alter publication supabase_realtime add table public.notifications;
exception when others then null;
end $$;

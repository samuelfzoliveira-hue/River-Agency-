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

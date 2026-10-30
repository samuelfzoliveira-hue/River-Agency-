-- Storage: políticas por agência/cliente, banco de mídia com arquivo e prévias assinadas.
truncate public.t_results;
\set G  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''G'')::text, false); set role authenticated;'
\set D  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''D'')::text, false); set role authenticated;'
\set S  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''S'')::text, false); set role authenticated;'
\set L  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''L'')::text, false); set role authenticated;'
\set X  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''X'')::text, false); set role authenticated;'
\set ANON 'reset role; select set_config(''request.jwt.claim.sub'', '''', false); set role anon;'
\set PG 'reset role;'
create function public.org1() returns text language sql stable as $$ select org_id::text from public.clients where id = public.u('1') $$;
grant execute on function public.org1() to public;

:PG
select t_ok('bucket media é privado e limitado', (select not public and file_size_limit = 52428800 and 'video/mp4' = any(allowed_mime_types) and not 'text/html' = any(allowed_mime_types) from storage.buckets where id = 'media'));
:D
insert into storage.objects (bucket_id, name) values ('media', public.app_org()::text || '/' || public.u('1')::text || '/a-logo.png');
select t_count('equipe envia arquivo na pasta de um cliente da agência', $$select count(*) from storage.objects where name like '%a-logo.png'$$, 1);
select t_err('pasta de outra agência é bloqueada', $$insert into storage.objects (bucket_id, name) values ('media', gen_random_uuid()::text || '/' || public.u('1')::text || '/x.png')$$);
select t_err('cliente inexistente na pasta é bloqueado', $$insert into storage.objects (bucket_id, name) values ('media', public.app_org()::text || '/' || gen_random_uuid()::text || '/x.png')$$);
select t_err('outro bucket não é coberto pelas políticas', $$insert into storage.objects (bucket_id, name) values ('outro', public.app_org()::text || '/' || public.u('1')::text || '/x.png')$$);
select t_err('arquivo solto na raiz é bloqueado', $$insert into storage.objects (bucket_id, name) values ('media', 'x.png')$$);
:S
select t_count('colega da agência lê o arquivo', $$select count(*) from storage.objects where name like '%a-logo.png'$$, 1);
select t_rows('colega comum não apaga arquivo de outro', $$delete from storage.objects where name like '%a-logo.png'$$, 0);
:D
select t_rows('dono apaga o próprio arquivo', $$delete from storage.objects where name like '%a-logo.png'$$, 1);
:D
insert into storage.objects (bucket_id, name) values ('media', public.app_org()::text || '/' || public.u('1')::text || '/b-video.mp4');
:G
select t_rows('gestor apaga arquivo de qualquer pessoa', $$delete from storage.objects where name like '%b-video.mp4'$$, 1);
:D
insert into storage.objects (bucket_id, name) values ('media', public.app_org()::text || '/' || public.u('1')::text || '/c.png');
:L
select t_count('cliente não lê arquivos da agência', 'select count(*) from storage.objects', 0);
select t_err('cliente não envia arquivos', $$insert into storage.objects (bucket_id, name) values ('media', public.app_org()::text || '/' || public.u('1')::text || '/y.png')$$);
:X
select t_count('outra agência não vê arquivos', 'select count(*) from storage.objects', 0);
:ANON
select t_err('anônimo não lê storage', $$select * from storage.objects$$);

-- banco de mídia: link OU arquivo, e caminho coerente com org/cliente
:S
insert into media_assets (org_id, client_id, name, storage_path, size_bytes, kind, created_by) values (public.app_org(), u('1'), 'Logo', public.app_org()::text || '/' || u('1')::text || '/c.png', 1234, 'imagem', u('S'));
select t_count('registro de arquivo no banco de mídia', $$select count(*) from media_assets where storage_path is not null$$, 1);
select t_err('caminho de outra agência é recusado', $$insert into media_assets (org_id, client_id, name, storage_path, created_by) values (public.app_org(), public.u('1'), 'x', gen_random_uuid()::text || '/' || public.u('1')::text || '/z.png', public.u('S'))$$);
select t_err('caminho de outro cliente é recusado', $$insert into media_assets (org_id, client_id, name, storage_path, created_by) values (public.app_org(), public.u('1'), 'x', public.app_org()::text || '/' || public.u('2')::text || '/z.png', public.u('S'))$$);
select t_err('não aceita link e arquivo juntos', $$insert into media_assets (org_id, client_id, name, url, storage_path, created_by) values (public.app_org(), public.u('1'), 'x', 'https://a.com', public.app_org()::text || '/' || public.u('1')::text || '/c.png', public.u('S'))$$);
select t_err('exige link ou arquivo', $$insert into media_assets (org_id, client_id, name, created_by) values (public.app_org(), public.u('1'), 'x', public.u('S'))$$);

-- prévias por arquivo: snapshot de URLs assinadas no link
:PG
update contents set status_id = (select id from pipeline_statuses where name = 'Revisão interna' and deliverable_type_id is null and org_id = (select org_id from contents where id = u('r'))) where id = u('r');
:G
insert into content_versions (org_id, content_id, caption, media) values (public.app_org(), u('r'), 'v com arquivo', '[{"name":"capa","path":"x/y/c.png","kind":"imagem"}]');
select public.request_approval(u('r'), h('tok-arq'), now() + interval '1 day', '[{"name":"capa","url":"https://signed.example/c.png?token=abc","kind":"imagem"}]');
:ANON
select t_ok('cliente (link) recebe a URL assinada, não o caminho interno', (select public.approval_view('tok-arq')->'media'->0->>'url') = 'https://signed.example/c.png?token=abc' and (select public.approval_view('tok-arq')->'media'->0->>'path') is null);
:L
select t_ok('portal também recebe a URL assinada', (select public.approval_view_portal(u('r'))->'media'->0->>'url') = 'https://signed.example/c.png?token=abc');
:G
select public.request_approval(u('r'), h('tok-link'), now() + interval '1 day');
:ANON
select t_ok('sem snapshot, usa as prévias da versão (links)', (select public.approval_view('tok-link')->'media'->0->>'path') = 'x/y/c.png');

:PG
select format('FAIL: %s (%s)', name, detail) from public.t_results where not ok;
select format('%s: passou %s de %s', case when bool_and(ok) then 'PASS' else 'FAIL' end, count(*) filter (where ok), count(*)) from public.t_results;

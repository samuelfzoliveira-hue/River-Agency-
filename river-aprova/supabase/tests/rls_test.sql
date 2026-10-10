-- Testes de segurança (RLS, funções, storage). Executar após stubs + migrações. Saída: PASS/FAIL.
create table public.t_results (name text, ok boolean, detail text);
grant all on public.t_results to public;
create function public.t_ok(n text, cond boolean) returns void language sql as
  $$ insert into public.t_results values (n, coalesce(cond, false), null) $$;
create function public.t_err(n text, q text) returns void language plpgsql as $$
begin
  execute q;
  insert into public.t_results values (n, false, 'não deu erro');
exception when others then
  insert into public.t_results values (n, true, sqlerrm);
end $$;
create function public.t_rows(n text, q text, expected int) returns void language plpgsql as $$
declare c int;
begin
  begin execute q; get diagnostics c = row_count;
  exception when others then c := 0; end;
  insert into public.t_results values (n, c = expected, 'linhas=' || c);
end $$;
grant execute on function public.t_ok(text, boolean), public.t_err(text, text), public.t_rows(text, text, int) to public;

\set A '00000000-0000-0000-0000-0000000000a1'
\set C1 '00000000-0000-0000-0000-0000000000c1'
\set C2 '00000000-0000-0000-0000-0000000000c2'
\set CLA '11111111-1111-1111-1111-111111111111'
\set CLB '22222222-2222-2222-2222-222222222222'

-- ── Cadastro ──
select t_err('cadastro público com e-mail qualquer é bloqueado', $$insert into auth.users(email) values ('hacker@x.com')$$);
insert into auth.users (id, email) values (:'A', 'riiveragency@gmail.com');
select t_ok('e-mail do admin vira admin', (select role = 'admin' from profiles where id = :'A'));
insert into allowed_signups values ('cliente1@x.com'), ('cliente2@x.com');
insert into auth.users (id, email) values (:'C1', 'cliente1@x.com'), (:'C2', 'cliente2@x.com');
select t_ok('clientes viram cliente', (select count(*) = 2 from profiles where role = 'cliente'));
insert into clients (id, user_id, nome_marca, instagram) values (:'CLA', :'C1', 'Marca A', 'marca_a'), (:'CLB', :'C2', 'Marca B', 'marca_b');
insert into storage.objects (bucket_id, name) values ('media', :'CLA' || '/a.jpg'), ('media', :'CLB' || '/b.jpg');

-- ── Admin cria conteúdos ──
set role authenticated; select set_config('request.jwt.claim.sub', :'A', false);
create temp table ids (k text, id uuid); grant all on ids to public;
insert into ids select 'flyerA', create_content(:'CLA', 'flyer', current_date + 5, now() + interval '3 days', false, E'Linha 1\n\n#tag 😀', jsonb_build_array(jsonb_build_object('tipo','imagem','url', :'CLA' || '/a.jpg')));
insert into ids select 'carA', create_content(:'CLA', 'carrossel', current_date + 6, now() + interval '3 days', false, 'car', jsonb_build_array(
  jsonb_build_object('tipo','imagem','url', :'CLA' || '/1.jpg'), jsonb_build_object('tipo','imagem','url', :'CLA' || '/2.jpg'), jsonb_build_object('tipo','imagem','url', :'CLA' || '/3.jpg')));
insert into ids select 'reelsB', create_content(:'CLB', 'reels', current_date + 7, now() + interval '3 days', false, 'r', jsonb_build_array(
  jsonb_build_object('tipo','video','url', :'CLB' || '/v.mp4'), jsonb_build_object('tipo','capa','url', :'CLB' || '/c.jpg')));
insert into ids select 'pubA', create_content(:'CLA', 'flyer', current_date - 30, null, true, 'antigo', jsonb_build_array(jsonb_build_object('tipo','imagem','url', :'CLA' || '/old.jpg')));
select t_ok('já publicado entra como publicado', (select status = 'publicado' from contents where id = (select id from ids where k='pubA')));
select t_err('admin: mídia de outro cliente é recusada', format($q$select create_content(%L, 'flyer', current_date, now(), false, 'x', %L::jsonb)$q$, :'CLA', '[{"tipo":"imagem","url":"' || :'CLB' || '/b.jpg"}]'));
select t_err('admin: carrossel com 1 imagem é recusado', format($q$select create_content(%L, 'carrossel', current_date, now(), false, 'x', %L::jsonb)$q$, :'CLA', '[{"tipo":"imagem","url":"' || :'CLA' || '/b.jpg"}]'));
select t_err('admin: reels sem capa é recusado', format($q$select create_content(%L, 'reels', current_date, now(), false, 'x', %L::jsonb)$q$, :'CLA', '[{"tipo":"video","url":"' || :'CLA' || '/b.mp4"}]'));
select t_err('admin: path traversal é recusado', format($q$select create_content(%L, 'flyer', current_date, now(), false, 'x', %L::jsonb)$q$, :'CLA', '[{"tipo":"imagem","url":"' || :'CLA' || '/../' || :'CLB' || '/b.jpg"}]'));
select t_ok('legenda preserva quebras e emojis', (select legenda = E'Linha 1\n\n#tag 😀' from content_versions where content_id = (select id from ids where k='flyerA')));
select t_ok('admin vê todos os conteúdos', (select count(*) = 4 from contents));
reset role;

-- ── Cliente 1 ──
set role authenticated; select set_config('request.jwt.claim.sub', :'C1', false);
select t_err('cliente não lê allowed_signups', $q$select * from allowed_signups$q$);
select t_err('cliente não grava em allowed_signups', $q$insert into allowed_signups values ('x@x.com')$q$);
select t_ok('is_admin() é falso para cliente', not is_admin());
select t_ok('cliente vê só os próprios conteúdos', (select count(*) = 3 and bool_and(client_id = :'CLA') from contents));
select t_ok('cliente não vê conteúdo de outro (por id direto)', (select count(*) = 0 from contents where id = (select id from ids where k='reelsB')));
select t_ok('cliente não vê versões de outro', (select count(*) = 0 from content_versions where content_id = (select id from ids where k='reelsB')));
select t_ok('cliente não vê mídias de outro', (select count(*) = 0 from content_media where url like :'CLB' || '/%'));
select t_ok('cliente vê mídias próprias', (select count(*) = 5 from content_media));
select t_ok('cliente vê só o próprio cliente', (select count(*) = 1 from clients));
select t_ok('cliente vê só o próprio perfil', (select count(*) = 1 from profiles));
select t_ok('cliente não vê notificações', (select count(*) = 0 from notifications));
select t_rows('cliente não altera conteúdo', format($q$update contents set status = 'aprovado' where id = %L$q$, (select id from ids where k='flyerA')), 0);
select t_err('cliente não insere conteúdo direto', format($q$insert into contents (client_id, tipo) values (%L, 'flyer')$q$, :'CLA'));
select t_rows('cliente não apaga conteúdo', format($q$delete from contents where id = %L$q$, (select id from ids where k='flyerA')), 0);
select t_err('cliente não escreve no log', format($q$insert into approval_log (content_id, numero_versao, user_id, acao) values (%L, 1, %L, 'aprovado')$q$, (select id from ids where k='flyerA'), :'C1'));
select t_err('cliente não vira admin', format($q$update profiles set role = 'admin' where id = %L$q$, :'C1'));
select t_err('cliente não cria cliente direto', format($q$insert into clients (user_id, nome_marca, instagram) values (%L, 'x', 'x')$q$, :'C2'));
select t_err('cliente não cria conteúdo (RPC)', format($q$select create_content(%L, 'flyer', current_date, now(), false, 'x', %L::jsonb)$q$, :'CLA', '[{"tipo":"imagem","url":"' || :'CLA' || '/z.jpg"}]'));
select t_err('cliente não reabre', format($q$select reopen_content(%L, null)$q$, (select id from ids where k='flyerA')));
select t_err('cliente não marca como publicado', format($q$select mark_published(%L)$q$, (select id from ids where k='flyerA')));
select t_err('cliente não reordena feed', format($q$select reorder_feed(%L, array[%L]::uuid[])$q$, :'CLA', (select id from ids where k='flyerA')));
select t_err('cliente não envia versão', format($q$select create_content_version(%L, 'x', null)$q$, (select id from ids where k='flyerA')));
select t_err('cliente não decide conteúdo de outro', format($q$select decide_content(%L, 'aprovado', null, null, null)$q$, (select id from ids where k='reelsB')));
select t_err('ajuste sem comentário é recusado', format($q$select decide_content(%L, 'ajuste_solicitado', '   ', null, null)$q$, (select id from ids where k='flyerA')));
select t_err('slide inválido é recusado', format($q$select decide_content(%L, 'ajuste_solicitado', 'x', 9, null)$q$, (select id from ids where k='carA')));
select t_err('tempo em flyer é recusado', format($q$select decide_content(%L, 'ajuste_solicitado', 'x', null, '01:00')$q$, (select id from ids where k='flyerA')));
select t_err('decidir conteúdo já publicado é recusado', format($q$select decide_content(%L, 'aprovado', null, null, null)$q$, (select id from ids where k='pubA')));
select decide_content((select id from ids where k='flyerA'), 'ajuste_solicitado', 'Trocar a cor', null, null);
select decide_content((select id from ids where k='carA'), 'ajuste_solicitado', 'Slide 2 com erro', 2, null);
select t_ok('ajuste muda status', (select count(*) = 2 from contents where status = 'ajuste_solicitado'));
select t_err('decidir de novo (fora de aguardando) é recusado', format($q$select decide_content(%L, 'aprovado', null, null, null)$q$, (select id from ids where k='flyerA')));
select t_ok('cliente lê o próprio log', (select count(*) = 2 from approval_log));
select complete_password_change();
reset role;
select t_ok('log registra versão, slide e comentário', (select count(*) = 1 from approval_log where slide_referencia = 2 and numero_versao = 1 and comentario = 'Slide 2 com erro'));

-- ── Storage ──
set role authenticated; select set_config('request.jwt.claim.sub', :'C1', false);
select t_ok('storage: cliente vê só a própria pasta', (select count(*) = 1 and bool_and(name like :'CLA' || '/%') from storage.objects));
select t_err('storage: cliente não envia arquivo', format($q$insert into storage.objects (bucket_id, name) values ('media', %L)$q$, :'CLA' || '/hack.jpg'));
select t_rows('storage: cliente não apaga', $q$delete from storage.objects$q$, 0);
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', :'C2', false);
select t_ok('storage: outro cliente vê só a sua pasta', (select count(*) = 1 and bool_and(name like :'CLB' || '/%') from storage.objects));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', :'A', false);
select t_ok('storage: admin vê tudo', (select count(*) = 2 from storage.objects));
insert into storage.objects (bucket_id, name) values ('media', :'CLA' || '/novo.jpg');
select t_ok('storage: admin envia', true);
reset role;

-- ── Admin: notificações, reabrir, versões, feed ──
set role authenticated; select set_config('request.jwt.claim.sub', :'A', false);
select t_ok('admin vê notificações das decisões', (select count(*) = 2 from notifications));
update notifications set lida = true;
select t_ok('admin marca como lida', (select count(*) = 2 from notifications where lida));
select t_err('admin não edita título da notificação', $q$update notifications set titulo = 'x'$q$);
select t_err('reabrir exige aprovado', format($q$select reopen_content(%L, null)$q$, (select id from ids where k='flyerA')));
select t_ok('nova versão: retorna 2', (select create_content_version((select id from ids where k='flyerA'), 'Legenda v2', null) = 2));
select t_ok('nova versão volta para aguardando', (select status = 'aguardando' and versao_atual = 2 from contents where id = (select id from ids where k='flyerA')));
select t_ok('versão anterior preservada', (select count(*) = 2 from content_versions where content_id = (select id from ids where k='flyerA')));
select t_ok('mídia copiada para a v2', (select count(*) = 1 from content_media m join content_versions v on v.id = m.version_id where v.content_id = (select id from ids where k='flyerA') and v.numero_versao = 2));
select t_err('nova versão exige ajuste solicitado', format($q$select create_content_version(%L, 'x', null)$q$, (select id from ids where k='flyerA')));
select reorder_feed(:'CLA', array[(select id from ids where k='carA'), (select id from ids where k='flyerA')]);
select t_ok('ordem salva', (select ordem_feed = 1 from contents where id = (select id from ids where k='carA')));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', :'C1', false);
select decide_content((select id from ids where k='flyerA'), 'aprovado', null, null, null);
select t_err('aprovado fica bloqueado', format($q$select decide_content(%L, 'ajuste_solicitado', 'x', null, null)$q$, (select id from ids where k='flyerA')));
reset role;
set role authenticated; select set_config('request.jwt.claim.sub', :'A', false);
select reopen_content((select id from ids where k='flyerA'), 'Reaberto pela agência');
select t_ok('admin reabre aprovado', (select status = 'aguardando' from contents where id = (select id from ids where k='flyerA')));
select t_ok('log registra reabertura', (select count(*) = 1 from approval_log where acao = 'reaberto'));
reset role;

-- ── Admin: tabelas internas ──
set role authenticated; select set_config('request.jwt.claim.sub', :'A', false);
select t_err('admin (via app) também não lê allowed_signups', $q$select * from allowed_signups$q$);
reset role;

-- ── Anônimo ──
select set_config('request.jwt.claim.sub', '', false);
select t_ok('anon não tem EXECUTE nas funções sensíveis', not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('create_content','decide_content','reopen_content','mark_published','reorder_feed','create_content_version','complete_password_change','is_admin','owns_client','can_read_content','can_read_version','validate_media','insert_media')
    and has_function_privilege('anon', p.oid, 'execute')));
select t_ok('authenticated não executa funções internas', not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname in ('validate_media','insert_media')
    and has_function_privilege('authenticated', p.oid, 'execute')));
set role anon;
select t_err('anon não lê conteúdos', $q$select * from contents$q$);
select t_err('anon não lê clientes', $q$select * from clients$q$);
select t_err('anon não lê perfis', $q$select * from profiles$q$);
select t_err('anon não executa decide_content', format($q$select decide_content(%L, 'aprovado', null, null, null)$q$, (select id from ids where k='flyerA')));
select t_err('anon não executa create_content', format($q$select create_content(%L, 'flyer', current_date, now(), false, 'x', '[]'::jsonb)$q$, :'CLA'));
reset role;

select case when ok then 'PASS' else 'FAIL' end as r, name, coalesce(detail, '') from public.t_results order by ok, name;
select count(*) filter (where ok) as passou, count(*) filter (where not ok) as falhou from public.t_results;

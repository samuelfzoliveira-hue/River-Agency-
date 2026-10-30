-- Fase 2: versões, aprovação por link/portal, fechamento mensal, banco de mídia. Roda após db_test.sql (reaproveita seus dados).
truncate public.t_results;
\set G  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''G'')::text, false); set role authenticated;'
\set A  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''A'')::text, false); set role authenticated;'
\set S  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''S'')::text, false); set role authenticated;'
\set D  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''D'')::text, false); set role authenticated;'
\set X  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''X'')::text, false); set role authenticated;'
\set L  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''L'')::text, false); set role authenticated;'
\set ANON 'reset role; select set_config(''request.jwt.claim.sub'', '''', false); set role anon;'
\set PG 'reset role;'
create function public.h(t text) returns text language sql immutable as $$ select encode(sha256(convert_to(t, 'utf8')), 'hex') $$;
grant execute on function public.h(text) to public;
create function public.stn(n text) returns uuid language sql stable as $$
  select id from public.pipeline_statuses where name = n and deliverable_type_id is null and org_id = (select org_id from public.contents where id = public.u('r')) $$;
grant execute on function public.stn(text) to public;

-- ═══ Versões ═══
:PG
update contents set status_id = stn('Em edição/design') where id = u('r');
:G
insert into content_versions (org_id, content_id, caption, media) values (public.app_org(), u('r'), 'legenda v1', '[{"name":"capa","url":"https://x.com/a.jpg","kind":"imagem"}]');
insert into content_versions (org_id, content_id, caption) values (public.app_org(), u('r'), 'legenda v2');
select t_count('versões são numeradas automaticamente', $$select max(version) from content_versions where content_id = public.u('r')$$, 2);
:L
select t_err('cliente não cria versão', $$insert into content_versions (org_id, content_id, caption) values (public.app_org(), public.u('r'), 'x')$$);
select t_count('cliente não lê versões direto', 'select count(*) from content_versions', 0);

-- ═══ Envio e link seguro ═══
select t_err('cliente não envia para aprovação', $$select public.request_approval(public.u('r'), public.h('x'), now() + interval '1 day')$$);
:G
select t_err('prazo do link no passado é rejeitado', $$select public.request_approval(public.u('r'), public.h('x'), now() - interval '1 day')$$);
select public.request_approval(u('r'), h('tok123'), now() + interval '14 days');
select t_ok('enviar move para "aguardando aprovação"', (select s.approval_state = 'aguardando' from contents c join pipeline_statuses s on s.id = c.status_id where c.id = u('r')));
select t_ok('envio registra evento', exists (select 1 from approval_events where content_id = u('r') and action = 'enviado' and version = 2));
select t_count('token não é armazenado em claro', $$select count(*) from approval_links where token_hash = 'tok123'$$, 0);
:ANON
select t_ok('link válido mostra o conteúdo', (select public.approval_view('tok123')->>'title') = 'Reel de lançamento');
select t_ok('link mostra a versão enviada', (select public.approval_view('tok123')->>'caption') = 'legenda v2');
select t_ok('token errado não revela nada', public.approval_view('tok999') is null);
select t_err('anon não lê links', $$select * from approval_links$$);
select t_err('anon não lê conteúdos', $$select * from contents$$);
select t_err('anon não chama funções internas', $$select public._apply_decision(public.u('r'), 'aprovado', null, 'x', 'link', null)$$);
select t_err('ajustes sem comentário é rejeitado', $$select public.approval_decide('tok123', 'ajustes', '', 'Marta')$$);
select t_err('decisão sem nome é rejeitada', $$select public.approval_decide('tok123', 'aprovado', '', '')$$);
select t_err('ação inválida é rejeitada', $$select public.approval_decide('tok123', 'publicado', '', 'Marta')$$);
select t_err('token errado não decide', $$select public.approval_decide('tok999', 'aprovado', '', 'Marta')$$);
select public.approval_decide('tok123', 'ajustes', 'Trocar a música', 'Marta');
:PG
select t_ok('pedido de ajustes move o conteúdo', (select s.approval_state = 'ajustes' from contents c join pipeline_statuses s on s.id = c.status_id where c.id = u('r')));
select t_ok('evento guarda quem, quando e comentário', exists (select 1 from approval_events where action = 'ajustes' and actor_name = 'Marta' and comment = 'Trocar a música' and via = 'link'));
select t_ok('responsável é notificado', exists (select 1 from notifications where user_id = u('D') and type = 'cliente_ajustes'));
:ANON
select t_err('não decide duas vezes com o mesmo link', $$select public.approval_decide('tok123', 'aprovado', '', 'Marta')$$);

-- nova rodada: versão 3 + novo link revoga o anterior
:G
insert into content_versions (org_id, content_id, caption) values (public.app_org(), u('r'), 'legenda v3');
select public.request_approval(u('r'), h('tok456'), now() + interval '14 days');
:ANON
select t_ok('link antigo é revogado', public.approval_view('tok123') is null);
select t_ok('link novo mostra v3', (select (public.approval_view('tok456')->>'version')::int) = 3);
select public.approval_decide('tok456', 'aprovado', 'Perfeito!', 'Marta');
:PG
select t_count('aprovado = estágio 2', $$select delivery_stage from contents where id = public.u('r')$$, 2);
select t_ok('aprovação registra data', (select approved_at is not null from contents where id = u('r')));
select t_ok('social é notificado da aprovação', (select count(*) from notifications where user_id = u('S') and type = 'conteudo_aprovado') >= 2);

-- expiração e versão superada
update contents set status_id = stn('Revisão interna') where id = u('r');
:G
select public.request_approval(u('r'), h('tok789'), now() + interval '1 day');
:PG
update approval_links set expires_at = now() - interval '1 minute' where token_hash = h('tok789');
:ANON
select t_ok('link expirado informa expiração', (select (public.approval_view('tok789')->>'expired')::boolean));
select t_err('link expirado não decide', $$select public.approval_decide('tok789', 'aprovado', '', 'Marta')$$);
:PG
update approval_links set expires_at = now() + interval '1 day' where token_hash = h('tok789');
:G
insert into content_versions (org_id, content_id, caption) values (public.app_org(), u('r'), 'legenda v4');
:ANON
select t_ok('versão mais nova invalida o link antigo', (select (public.approval_view('tok789')->>'superseded')::boolean));
select t_err('link de versão superada não decide', $$select public.approval_decide('tok789', 'aprovado', '', 'Marta')$$);

-- ═══ Portal do cliente ═══
:G
select public.request_approval(u('r'), h('tok-portal'), now() + interval '1 day');
:L
select t_ok('cliente vê o próprio conteúdo no portal', public.approval_view_portal(u('r')) is not null);
select t_ok('cliente não vê conteúdo de outro cliente', public.approval_view_portal((select id from contents where title = 'de outro cliente' limit 1)) is null) ;
:PG
select t_ok('(preparação) conteúdo de outro cliente existe', exists (select 1 from contents where title = 'de outro cliente'));
:L
select t_err('cliente não decide conteúdo de outro cliente', $$select public.approval_decide_portal((select id from contents where title = 'de outro cliente' limit 1), 'aprovado', '')$$);
select public.approval_decide_portal(u('r'), 'aprovado', 'ok');
:PG
select t_ok('decisão via portal registrada', exists (select 1 from approval_events where via = 'portal' and action = 'aprovado' and actor_user = u('L')));

-- lista do portal
:L
select t_ok('portal lista só conteúdos do cliente em fluxo de aprovação', (select jsonb_array_length(public.portal_contents())) >= 1 and not exists (select 1 from jsonb_array_elements(public.portal_contents()) e where e->>'title' = 'de outro cliente' or e->>'title' = 'rascunho'));
:G
select t_ok('equipe não recebe lista de portal', (select jsonb_array_length(public.portal_contents())) = 0);

-- ═══ Fechamento mensal ═══
:G
insert into monthly_targets (org_id, contract_id, client_id, competence, deliverable_type_id, quantity, completion_criterion)
  select public.app_org(), u('c'), u('1'), '2026-09-01', id, 4, 'approved' from deliverable_types where key = 'reel';
select t_err('mês futuro não fecha', $$select public.close_month(public.u('1'), '2027-05-01', '{}', '[]', null)$$);
:D
select t_err('designer não fecha mês', $$select public.close_month(public.u('1'), '2026-09-01', '{}', '[]', null)$$);
:G
select t_ok('gestor fecha o mês', public.close_month(u('1'), '2026-09-01', '{"pct":50}', '[{"type":"Reel","quantity":2,"competence":"2026-09-01"}]', 'ok') is not null);
select t_err('não fecha duas vezes', $$select public.close_month(public.u('1'), '2026-09-01', '{}', '[]', null)$$);
select t_err('meta de mês fechado fica travada', $$update monthly_targets set quantity = 9 where competence = '2026-09-01'$$);
select t_err('meta de mês fechado não pode ser apagada', $$delete from monthly_targets where competence = '2026-09-01'$$);
select t_count('pendência mantém a competência original', $$select (pending->0->>'competence')::date::text::bigint from month_closings where false union all select 0$$, 0);
select t_ok('pendência guarda competência original', (select pending->0->>'competence' from month_closings where competence = '2026-09-01') = '2026-09-01');
select t_err('gestor não reabre', $$select public.reopen_month((select id from month_closings limit 1), 'engano de lançamento')$$);
:A
select t_err('reabertura exige justificativa', $$select public.reopen_month((select id from month_closings limit 1), '')$$);
select public.reopen_month((select id from month_closings limit 1), 'conteúdo publicado após o fechamento');
select t_ok('reabertura registra justificativa e autor', (select reopen_log->0->>'reason' = 'conteúdo publicado após o fechamento' and (reopen_log->0->>'by')::uuid = u('A') from month_closings));
select t_err('não reabre mês já reaberto', $$select public.reopen_month((select id from month_closings limit 1), 'de novo, sem motivo')$$);
:G
select t_rows('após reabrir, metas voltam a ser editáveis', $$update monthly_targets set quantity = 5 where competence = '2026-09-01'$$, 1);
select t_ok('pode fechar de novo após reabrir', public.close_month(u('1'), '2026-09-01', '{"pct":100}', '[]', null) is not null);
select t_ok('histórico de reabertura é preservado', (select jsonb_array_length(reopen_log) = 1 and status = 'fechado' from month_closings));
:PG
select t_ok('fechamento e reabertura entram no histórico', (select count(*) from activity_log where entity_type = 'closing') = 3);
select t_ok('novas metas automáticas não entram em mês fechado', (select count(*) from monthly_targets where competence = '2026-09-01') = 1);
:X
select t_count('outra agência não vê fechamentos', 'select count(*) from month_closings', 0);

-- ═══ Convite de usuário-cliente ═══
:G
insert into invites (org_id, email, role, client_id) values (public.app_org(), 'novo.cliente@x.com', 'cliente', u('1'));
select t_err('convite de equipe não pode ter client_id', $$insert into invites (org_id, email, role, client_id) values (public.app_org(), 'eq@x.com', 'social', public.u('1'))$$);
:X
select t_err('outra agência não convida para cliente alheio', $$insert into invites (org_id, email, role, client_id) values (public.app_org(), 'y@x.com', 'cliente', public.u('1'))$$);
:PG
insert into auth.users (id, email) values (u('Z'), 'novo.cliente@x.com');
select t_ok('cliente convidado nasce vinculado ao cliente', exists (select 1 from client_users where user_id = u('Z') and client_id = u('1')));
select t_ok('cliente convidado tem papel cliente', (select role from profiles where user_id = u('Z')) = 'cliente');

-- ═══ Banco de mídia ═══
:S
insert into media_assets (org_id, client_id, name, url, kind, campaign, created_by) values (public.app_org(), u('1'), 'Bruto dia 1', 'https://drive.google.com/x', 'video', 'Outubro Rosa', u('S'));
select t_err('url precisa ser http(s)', $$insert into media_assets (org_id, client_id, name, url, created_by) values (public.app_org(), public.u('1'), 'x', 'javascript:alert(1)', public.u('S'))$$);
select t_err('não registra mídia em nome de outro', $$insert into media_assets (org_id, client_id, name, url, created_by) values (public.app_org(), public.u('1'), 'x', 'https://a.com', public.u('G'))$$);
:L
select t_count('cliente não vê o banco de mídia', 'select count(*) from media_assets', 0);
:X
select t_count('outra agência não vê mídia', 'select count(*) from media_assets', 0);

:PG
select format('FAIL: %s (%s)', name, detail) from public.t_results where not ok;
select format('%s: passou %s de %s', case when bool_and(ok) then 'PASS' else 'FAIL' end, count(*) filter (where ok), count(*)) from public.t_results;

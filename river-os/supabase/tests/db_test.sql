-- Testes de regras de negócio e segurança (RLS). Roda após stubs + migrações.
create table public.t_results (name text, ok boolean, detail text);
grant all on public.t_results to public;
create function public.u(n text) returns uuid language sql immutable as
  $$ select ('00000000-0000-0000-0000-' || lpad(to_hex(ascii(n)), 12, '0'))::uuid $$;
create function public.t_ok(n text, cond boolean) returns void language sql as
  $$ insert into public.t_results values (n, coalesce(cond, false), null) $$;
create function public.t_err(n text, q text) returns void language plpgsql as $$
begin
  execute q; insert into public.t_results values (n, false, 'não deu erro');
exception when others then insert into public.t_results values (n, true, sqlerrm);
end $$;
-- executa q e confere o número de linhas afetadas/retornadas
create function public.t_rows(n text, q text, expected int) returns void language plpgsql as $$
declare c int;
begin
  begin execute q; get diagnostics c = row_count; exception when others then c := -1; end;
  insert into public.t_results values (n, c = expected, 'linhas=' || c);
end $$;
create function public.t_count(n text, q text, expected bigint) returns void language plpgsql as $$
declare c bigint;
begin
  begin execute q into c; exception when others then c := -1; end;
  insert into public.t_results values (n, c = expected, 'valor=' || c);
end $$;

\set A  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''A'')::text, false); set role authenticated;'
\set G  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''G'')::text, false); set role authenticated;'
\set S  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''S'')::text, false); set role authenticated;'
\set D  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''D'')::text, false); set role authenticated;'
\set X  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''X'')::text, false); set role authenticated;'
\set L  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''L'')::text, false); set role authenticated;'
\set N  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''N'')::text, false); set role authenticated;'
\set ANON 'reset role; select set_config(''request.jwt.claim.sub'', '''', false); set role anon;'
\set PG 'reset role;'

-- ═══ Cadastro e convites ═══
:PG
insert into auth.users (id, email) values (u('A'), 'ana@river.com'), (u('X'), 'xavier@outra.com'), (u('N'), 'nada@x.com');
:A
select t_ok('bootstrap cria agência', (select public.bootstrap_organization('River Agency', 'Ana')) is not null);
select t_err('bootstrap duas vezes é bloqueado', $$select public.bootstrap_organization('Outra', 'Ana')$$);
select t_count('agência nasce com 12 etapas de pipeline', 'select count(*) from pipeline_statuses', 12);
select t_count('agência nasce com 5 tipos de entrega', 'select count(*) from deliverable_types', 5);
select t_ok('criador é administrador', (select role from profiles where user_id = u('A')) = 'admin');
insert into invites (org_id, email, role) select public.app_org(), e, r::user_role from (values
  ('gil@river.com','gestor'),('sol@river.com','social'),('duda@river.com','designer'),('lia@cliente.com','cliente')) v(e, r);
:PG
insert into auth.users (id, email) values (u('G'), 'Gil@river.com'), (u('S'), 'sol@river.com'), (u('D'), 'duda@river.com'), (u('L'), 'lia@cliente.com');
select t_ok('convite vira perfil com o papel convidado (e-mail case-insensitive)',
  (select role from profiles where user_id = u('G')) = 'gestor' and (select role from profiles where user_id = u('D')) = 'designer');
select t_ok('convite é marcado como aceito', (select count(*) from invites where accepted_at is not null) = 4);
select t_ok('quem não tem convite não ganha perfil', not exists (select 1 from profiles where user_id = u('N')));
:X
select public.bootstrap_organization('Outra Agência', 'Xavier');
:G
select t_err('gestor não convida administrador', $$insert into invites (org_id, email, role) values (public.app_org(), 'x@y.com', 'admin')$$);
insert into invites (org_id, email, role) values (public.app_org(), 'novo@river.com', 'videomaker');
select t_err('gestor não vira admin', $$update profiles set role = 'admin' where user_id = public.u('G')$$);
:A
select t_err('último admin não pode ser rebaixado', $$update profiles set role = 'gestor' where user_id = public.u('A')$$);
:N
select t_count('usuário sem perfil não vê clientes', 'select count(*) from clients', 0);
select t_err('usuário sem perfil não gera metas', $$select public.ensure_monthly_targets(current_date)$$);
:ANON
select t_err('anon não lê clientes', $$select * from clients$$);
:PG

-- ═══ Clientes, contratos e metas ═══
:G
insert into clients (id, org_id, name, segment, owner_id) values (u('1'), public.app_org(), 'Empresa A', 'Saúde', u('S'));
insert into clients (id, org_id, name) values (u('2'), public.app_org(), 'Empresa B');
insert into client_financials (client_id, org_id, monthly_value) values (u('1'), public.app_org(), 4500);
select t_ok('gestor lê valor mensal', (select monthly_value from client_financials where client_id = u('1')) = 4500);
:D
select t_err('designer não cria cliente', $$insert into clients (org_id, name) values (public.app_org(), 'X')$$);
select t_count('designer não vê valor mensal', 'select count(*) from client_financials', 0);
select t_count('designer vê clientes da agência', 'select count(*) from clients', 2);
:X
select t_count('outra agência não vê clientes', 'select count(*) from clients', 0);
select t_err('outra agência não cria conteúdo em cliente alheio', $$insert into contents (org_id, client_id, competence, deliverable_type_id, title, status_id)
  select public.app_org(), public.u('1'), '2026-10-01', (select id from deliverable_types limit 1), 'x', (select id from pipeline_statuses limit 1)$$);
:G
insert into contracts (id, org_id, client_id, start_date, completion_criterion) values (u('c'), public.app_org(), u('1'), '2026-01-01', 'approved');
insert into contract_items (contract_id, deliverable_type_id, quantity, periodicity)
  select u('c'), id, q, p::periodicity from (values ('reel', 8, 'monthly'), ('post', 2, 'weekly'), ('story', 1, 'biweekly'), ('captacao', 2, 'monthly')) v(k, q, p)
  join deliverable_types t on t.key = v.k;
insert into contracts (id, org_id, client_id, start_date, end_date) values (u('d'), public.app_org(), u('2'), '2026-01-01', '2026-09-30');
insert into contract_items (contract_id, deliverable_type_id, quantity) select u('d'), id, 5 from deliverable_types where key = 'reel';
select t_count('gera 4 metas em outubro (só contrato vigente)', $$select public.ensure_monthly_targets('2026-10-15')$$, 4);
select t_count('é idempotente', $$select public.ensure_monthly_targets('2026-10-01')$$, 0);
select t_count('semanal = qtd × segundas (out/26 tem 4)', $$select quantity from monthly_targets mt join deliverable_types t on t.id = mt.deliverable_type_id where t.key = 'post' and competence = '2026-10-01'$$, 8);
select t_count('quinzenal em outubro = 2', $$select quantity from monthly_targets mt join deliverable_types t on t.id = mt.deliverable_type_id where t.key = 'story' and competence = '2026-10-01'$$, 2);
select t_count('critério do contrato é copiado para a meta', $$select count(*) from monthly_targets where completion_criterion = 'approved'$$, 4);
update monthly_targets set quantity = 10 where competence = '2026-10-01' and deliverable_type_id = (select id from deliverable_types where key = 'reel');
select public.ensure_monthly_targets('2026-10-01');
select t_count('regerar não sobrescreve meta editada', $$select quantity from monthly_targets where competence = '2026-10-01' and deliverable_type_id = (select id from deliverable_types where key = 'reel')$$, 10);
select t_count('novembro tem 5 segundas: semanal = 10', $$select public.ensure_monthly_targets('2026-11-01')$$, 4);
select t_count('meta de novembro (semanal) = 10', $$select quantity from monthly_targets mt join deliverable_types t on t.id = mt.deliverable_type_id where t.key = 'post' and competence = '2026-11-01'$$, 10);
select t_count('quinzenal em novembro = ceil(5/2) = 3', $$select quantity from monthly_targets mt join deliverable_types t on t.id = mt.deliverable_type_id where t.key = 'story' and competence = '2026-11-01'$$, 3);
select t_count('mudar o contrato não altera meta de outubro', $$select quantity from monthly_targets where competence = '2026-10-01' and deliverable_type_id = (select id from deliverable_types where key='story')$$, 2);
update contracts set completion_criterion = 'published' where id = u('c');
select t_count('mudar critério preserva o histórico', $$select count(*) from monthly_targets where competence = '2026-10-01' and completion_criterion = 'approved'$$, 4);

-- ═══ Conteúdo: estágio, aprovação, atraso ═══
create temp table st as select name, id, stage from pipeline_statuses;
grant select on st to public;
insert into contents (id, org_id, client_id, contract_id, competence, deliverable_type_id, title, status_id, assignee_id, publish_date)
  select u('r'), public.app_org(), u('1'), u('c'), '2026-10-01', t.id, 'Reel de lançamento', (select id from st where name = 'Ideia'), u('D'), public.today_br() - 1
  from deliverable_types t where t.key = 'reel';
select t_count('conteúdo nasce com estágio 0', $$select delivery_stage from contents where id = public.u('r')$$, 0);
:D
update contents set status_id = (select id from st where name = 'Aguardando aprovação do cliente') where id = u('r');
select t_count('aguardando aprovação = estágio 1 (produzido)', $$select delivery_stage from contents where id = public.u('r')$$, 1);
:G
update contents set status_id = (select id from st where name = 'Aprovado') where id = u('r');
select t_ok('aprovação registra data e responsável', (select approved_at is not null and approved_by = u('G') from contents where id = u('r')));
select t_count('aprovado = estágio 2', $$select delivery_stage from contents where id = public.u('r')$$, 2);
update contents set status_id = (select id from st where name = 'Publicado') where id = u('r');
select t_ok('publicado após a data prevista fica marcado como atrasado', (select published_late and delivery_stage = 4 and published_at is not null from contents where id = u('r')));
update contents set status_id = (select id from st where name = 'Ajustes solicitados') where id = u('r');
select t_count('voltar para ajustes tira o conteúdo da contagem (estágio 1)', $$select delivery_stage from contents where id = public.u('r')$$, 1);
select t_ok('marca de publicação fora do prazo é preservada', (select published_late from contents where id = u('r')));
insert into contents (id, org_id, client_id, competence, deliverable_type_id, title, status_id, publish_date)
  select u('p'), public.app_org(), u('1'), '2026-10-01', t.id, 'Post no prazo', (select id from st where name = 'Publicado'), public.today_br() + 3
  from deliverable_types t where t.key = 'post';
select t_ok('publicado antes da data prevista não é atrasado', (select not published_late from contents where id = u('p')));
-- etapa específica de tipo
:A
insert into pipeline_statuses (org_id, deliverable_type_id, name, position, stage)
  select public.app_org(), id, 'Etapa só de story', 99, 0 from deliverable_types where key = 'story';
:G
select t_err('etapa específica de outro tipo é rejeitada', $$update contents set status_id = (select id from pipeline_statuses where name = 'Etapa só de story') where id = public.u('r')$$);
reset role;
select t_ok('histórico registra a mudança de etapa com nomes', exists (select 1 from activity_log where entity_id = u('r') and action = 'status' and details->'status'->>'para' = 'Aprovado'));
select t_ok('histórico registra o autor', exists (select 1 from activity_log where entity_id = u('r') and action = 'status' and actor_id = u('G')));

-- ═══ Tarefas, notificações ═══
:G
insert into tasks (id, org_id, client_id, content_id, title, assignee_id, due_date, estimated_hours, created_by)
  values (u('t'), public.app_org(), u('1'), u('r'), 'Editar vídeo', u('D'), public.today_br() + 1, 5, u('G'));
:D
select t_count('designer recebeu a notificação da tarefa', $$select count(*) from notifications where type = 'tarefa_atribuida'$$, 1);
select t_count('designer não lê notificações alheias', $$select count(*) from notifications where user_id <> public.u('D')$$, 0);
select t_count('conteúdo atribuído notificou o designer', $$select count(*) from notifications where type = 'conteudo_atribuido'$$, 1);
update tasks set status = 'done' where id = u('t');
select t_ok('concluir tarefa grava completed_at', (select completed_at is not null from tasks where id = u('t')));
:S
select t_count('social vê a notificação de conteúdo aprovado', $$select count(*) from notifications where type = 'conteudo_aprovado'$$, 1);
select t_rows('social não edita tarefa que não é dele', $$update tasks set title = 'hack' where id = public.u('t')$$, 0);
insert into comments (org_id, entity_type, entity_id, author_id, body, mentions) values (public.app_org(), 'content', u('r'), u('S'), 'oi @duda', array[u('D')]);
:D
select t_count('menção gera notificação', $$select count(*) from notifications where type = 'mencao'$$, 1);
select t_err('não dá para comentar como outro autor', $$insert into comments (org_id, entity_type, entity_id, author_id, body) values (public.app_org(), 'content', public.u('r'), public.u('S'), 'x')$$);
select t_err('push_notification não é chamável pelo cliente da API', $$select public.push_notification(public.app_org(), public.u('S'), 't', 'x', null, null)$$);

-- ═══ Capacidade: indisponibilidade ═══
insert into member_unavailability (org_id, user_id, starts_on, ends_on, kind) values (public.app_org(), u('D'), '2026-11-02', '2026-11-06', 'ferias');
select t_count('colaborador registra a própria indisponibilidade', 'select count(*) from member_unavailability', 1);
:S
select t_err('social não registra férias de outro', $$insert into member_unavailability (org_id, user_id, starts_on, ends_on) values (public.app_org(), public.u('D'), '2026-12-01', '2026-12-02')$$);

-- ═══ Capturas ═══
:G
insert into shoots (id, org_id, client_id, competence, starts_at) values (u('s'), public.app_org(), u('1'), '2026-10-01', now() + interval '1 day');
insert into shoot_contents (shoot_id, content_id) values (u('s'), u('r'));
update shoots set status = 'realizada' where id = u('s');
:D
select t_count('captação concluída notifica o editor', $$select count(*) from notifications where type = 'captacao_concluida'$$, 1);

-- ═══ Usuário cliente ═══
:PG
insert into client_users values (u('L'), u('1'));
update contents set status_id = (select id from st where name = 'Aguardando aprovação do cliente') where id = u('r');
-- rascunho do cliente 1 e conteúdo aprovado de outro cliente: nenhum dos dois pode aparecer para a cliente L
insert into contents (org_id, client_id, competence, deliverable_type_id, title, status_id)
  select o.id, c.id, date '2026-10-01', (select id from deliverable_types limit 1), 'rascunho', (select id from st where name = 'Roteiro')
  from organizations o, clients c where c.id = u('1') and o.id = c.org_id
  union all
  select o.id, c.id, date '2026-10-01', (select id from deliverable_types limit 1), 'de outro cliente', (select id from st where name = 'Aprovado')
  from organizations o, clients c where c.id = u('2') and o.id = c.org_id;
:L
select t_count('cliente vê só o próprio cliente', 'select count(*) from clients', 1);
select t_count('cliente vê só conteúdo em fluxo de aprovação do seu cliente (sem rascunho nem outro cliente)', 'select count(*) from contents', 2);
select t_count('cliente não vê tarefas internas', 'select count(*) from tasks', 0);
select t_count('cliente não vê valor mensal', 'select count(*) from client_financials', 0);
select t_count('cliente não vê contratos', 'select count(*) from contracts', 0);
select t_count('cliente não vê histórico interno', 'select count(*) from activity_log', 0);
select t_count('cliente não vê comentários internos', 'select count(*) from comments', 0);
select t_rows('cliente não altera conteúdo (0 linhas)', $$update contents set title = 'x'$$, 0);
select t_err('cliente não cria conteúdo', $$insert into contents (org_id, client_id, competence, deliverable_type_id, title, status_id) select public.app_org(), public.u('1'), '2026-10-01', (select id from deliverable_types limit 1), 'x', (select id from pipeline_statuses limit 1)$$);
select t_err('cliente não gera metas', $$select public.ensure_monthly_targets('2026-10-01')$$);

-- ═══ Resultado ═══
:PG
select format('FAIL: %s (%s)', name, detail) from public.t_results where not ok;
select format('%s: passou %s de %s', case when bool_and(ok) then 'PASS' else 'FAIL' end, count(*) filter (where ok), count(*)) from public.t_results;

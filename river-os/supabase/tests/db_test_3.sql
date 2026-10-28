-- Fase 3: histórico de etapas, automações e fila de e-mail.
truncate public.t_results;
\set G  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''G'')::text, false); set role authenticated;'
\set A  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''A'')::text, false); set role authenticated;'
\set D  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''D'')::text, false); set role authenticated;'
\set S  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''S'')::text, false); set role authenticated;'
\set L  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''L'')::text, false); set role authenticated;'
\set X  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''X'')::text, false); set role authenticated;'
\set SVC 'reset role; set role service_role;'
\set PG 'reset role;'

-- ═══ Histórico de etapas ═══
:PG
:G
insert into contents (id, org_id, client_id, competence, deliverable_type_id, title, status_id)
  select u('h'), public.app_org(), u('1'), date_trunc('month', public.today_br())::date, t.id, 'Histórico', (select id from pipeline_statuses where org_id = public.app_org() and name = 'Ideia')
  from deliverable_types t where t.key = 'post' and t.org_id = public.app_org();
select t_count('conteúdo novo abre uma linha de histórico', $$select count(*) from content_status_history where content_id = public.u('h') and left_at is null and not backfilled$$, 1);
update contents set status_id = (select id from pipeline_statuses where org_id = public.app_org() and name = 'Roteiro') where id = u('h');
update contents set status_id = (select id from pipeline_statuses where org_id = public.app_org() and name = 'Ajustes solicitados') where id = u('h');
select t_count('mudança de etapa fecha a anterior e abre a nova', $$select count(*) from content_status_history where content_id = public.u('h')$$, 3);
select t_count('só uma linha aberta por conteúdo', $$select count(*) from content_status_history where content_id = public.u('h') and left_at is null$$, 1);
select t_ok('guarda estágio e estado de aprovação', exists (select 1 from content_status_history where content_id = u('h') and approval_state = 'ajustes' and stage = 1));
select t_ok('guarda quem moveu', exists (select 1 from content_status_history where content_id = u('h') and entered_by = u('G')));
update contents set title = 'Histórico 2' where id = u('h');
select t_count('editar sem mudar de etapa não cria histórico', $$select count(*) from content_status_history where content_id = public.u('h')$$, 3);
:X
select t_count('outra agência não vê o histórico', 'select count(*) from content_status_history', 0);
:L
select t_count('cliente não vê o histórico', 'select count(*) from content_status_history', 0);

-- ═══ Automações ═══
:G
insert into tasks (id, org_id, client_id, title, assignee_id, due_date, status, created_by) values
  (u('p'), public.app_org(), u('1'), 'Prazo amanhã', u('D'), public.today_br() + 1, 'todo', u('G')),
  (u('q'), public.app_org(), u('1'), 'Já venceu', u('D'), public.today_br() - 2, 'doing', u('G')),
  (u('o'), public.app_org(), u('1'), 'Longe', u('D'), public.today_br() + 20, 'todo', u('G'));
:PG
delete from notifications where user_id = u('D');
delete from automation_runs; delete from automation_log;
:D
select t_ok('automação roda e cria notificações', public.run_automations() > 0);
select t_count('prazo próximo notifica o responsável', $$select count(*) from notifications where type = 'prazo_proximo' and user_id = public.u('D') and title like '%Prazo amanhã%'$$, 1);
select t_count('tarefa longe do prazo não notifica', $$select count(*) from notifications where title like '%Longe%'$$, 0);
select t_count('tarefa atrasada notifica o responsável', $$select count(*) from notifications where type = 'tarefa_atrasada' and title like '%Já venceu%'$$, 1);
select t_count('segunda chamada em seguida não faz nada (limite de 30 min)', $$select public.run_automations()$$, 0);
select t_count('designer não consegue forçar a reexecução', $$select public.run_automations(null, true)$$, 0);
:G
select t_ok('gestor força e não duplica (idempotente por dia)', public.run_automations(null, true) is not null);
select t_count('sem duplicar prazo próximo', $$select count(*) from notifications where type = 'prazo_proximo' and title like '%Prazo amanhã%'$$, 0);
:PG
select t_count('(visão do dono) uma notificação por tarefa e dia', $$select count(*) from notifications where type = 'prazo_proximo' and title like '%Prazo amanhã%'$$, 1);
select t_ok('gestores recebem resumo de atrasos', (select count(*) from notifications where type = 'atraso_gestor') >= 1);
select t_count('resumo de atraso não se repete no dia', $$select count(*) from notifications where type = 'atraso_gestor' and user_id = public.u('G')$$, 1);

-- cliente demorando e contrato encerrando
update contents set status_id = (select id from pipeline_statuses where org_id = (select org_id from contents where id = u('r')) and name = 'Aguardando aprovação do cliente' and deliverable_type_id is null) where id = u('r');
update contents set status_changed_at = now() - interval '3 days' where id = u('r');
update clients set owner_id = u('S') where id = u('1');
update contracts set end_date = public.today_br() + 10, status = 'ativo' where id = u('c');
delete from automation_runs;
select t_ok('regras de aprovação lenta e fim de contrato rodam', public.run_automations(null, true) is not null) ;
:A
select t_ok('(admin) rodada interna', public.run_automations(null, true) >= 0);
:PG
select t_ok('responsável pelo cliente é avisado da aprovação lenta', exists (select 1 from notifications where user_id = u('S') and type = 'aprovacao_lenta'));
select t_ok('gestores são avisados do fim do contrato', exists (select 1 from notifications where type = 'contrato_encerrando'));
:L
select t_err('cliente não roda automações', $$select public.run_automations()$$);
:X
select t_count('outra agência não recebe notificações alheias', 'select count(*) from notifications', 0);

-- ═══ Fila de e-mail ═══
:G
select t_err('usuário comum não lê a fila de e-mail', $$select * from public.email_queue()$$);
select t_err('usuário comum não marca e-mails', $$select public.email_mark_sent(array[gen_random_uuid()])$$);
:SVC
select t_ok('serviço lê a fila', (select count(*) from public.email_queue(10)) > 0);
select public.email_mark_sent((select array_agg(id) from public.email_queue(1000)));
select t_count('após marcar, a fila esvazia', 'select count(*) from public.email_queue(1000)', 0);

:PG
select format('FAIL: %s (%s)', name, detail) from public.t_results where not ok;
select format('%s: passou %s de %s', case when bool_and(ok) then 'PASS' else 'FAIL' end, count(*) filter (where ok), count(*)) from public.t_results;

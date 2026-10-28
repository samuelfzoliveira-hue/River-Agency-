-- Registro de horas.
truncate public.t_results;
\set G  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''G'')::text, false); set role authenticated;'
\set D  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''D'')::text, false); set role authenticated;'
\set L  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''L'')::text, false); set role authenticated;'
\set X  'reset role; select set_config(''request.jwt.claim.sub'', public.u(''X'')::text, false); set role authenticated;'
\set PG 'reset role;'

:D
select t_ok('iniciar cronômetro devolve o lançamento', public.start_timer(u('p')) is not null);
select t_ok('iniciar muda a tarefa para em andamento', (select status = 'doing' from tasks where id = u('p')));
select t_count('só um cronômetro rodando por pessoa', $$select count(*) from time_entries where user_id = public.u('D') and ended_at is null$$, 1);
select public.start_timer(u('q'));
select t_count('iniciar outro encerra o anterior', $$select count(*) from time_entries where user_id = public.u('D') and ended_at is null$$, 1);
select t_ok('o anterior ficou com no mínimo 1 min', (select minutes >= 1 from time_entries where task_id = u('p')));
select t_ok('horas da tarefa são sincronizadas (0,0h arredondado de 1 min)', (select logged_hours = 0.0 from tasks where id = u('p')));
:PG
update time_entries set started_at = now() - interval '90 minutes' where task_id = u('q') and ended_at is null;
:D
select t_count('parar devolve os minutos (90)', 'select public.stop_timer()', 90);
select t_ok('horas da tarefa = soma dos lançamentos', (select logged_hours = 1.5 from tasks where id = u('q')));
select t_count('parar sem cronômetro retorna 0', 'select public.stop_timer()', 0);
select public.add_time_entry(u('q'), 45, public.today_br() - 1, 'revisão');
select t_ok('lançamento manual soma (1,5h + 0,75h = 2,3h)', (select logged_hours = 2.3 from tasks where id = u('q')));
select t_err('minutos inválidos', $$select public.add_time_entry(public.u('q'), 0, public.today_br(), null)$$);
select t_err('data futura é rejeitada', $$select public.add_time_entry(public.u('q'), 10, public.today_br() + 1, null)$$);
select t_err('data muito antiga é rejeitada', $$select public.add_time_entry(public.u('q'), 10, public.today_br() - 120, null)$$);
select t_err('tarefa inexistente', $$select public.add_time_entry(gen_random_uuid(), 10, public.today_br(), null)$$);
select t_rows('apaga o próprio lançamento', $$delete from time_entries where note = 'revisão'$$, 1);
select t_ok('apagar recalcula as horas', (select logged_hours = 1.5 from tasks where id = u('q')));
select t_err('não insere direto na tabela', $$insert into time_entries (org_id, task_id, user_id) values (public.app_org(), public.u('q'), public.u('D'))$$);
:PG
update time_entries set started_at = now() - interval '3 days' where false;
:G
select public.start_timer(u('o'));
:PG
update time_entries set started_at = now() - interval '3 days' where user_id = u('G') and ended_at is null;
:G
select t_count('cronômetro esquecido é limitado a 12 h (720 min)', 'select public.stop_timer()', 720);
:D
select t_rows('não apaga lançamento de outra pessoa', $$delete from time_entries where user_id = public.u('G')$$, 0);
:L
select t_err('cliente não inicia cronômetro', $$select public.start_timer(public.u('p'))$$);
select t_count('cliente não vê lançamentos', 'select count(*) from time_entries', 0);
:X
select t_err('outra agência não cronometra tarefa alheia', $$select public.start_timer(public.u('p'))$$);
select t_count('outra agência não vê lançamentos', 'select count(*) from time_entries', 0);
:G
select t_rows('gestor apaga lançamento de qualquer pessoa', $$delete from time_entries where user_id = public.u('D') and task_id = public.u('p')$$, 1);

:PG
select format('FAIL: %s (%s)', name, detail) from public.t_results where not ok;
select format('%s: passou %s de %s', case when bool_and(ok) then 'PASS' else 'FAIL' end, count(*) filter (where ok), count(*)) from public.t_results;

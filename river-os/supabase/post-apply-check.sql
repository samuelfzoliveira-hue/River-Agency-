-- Rode no SQL Editor do Supabase DEPOIS de aplicar as migrações. Cada linha deve mostrar ok = true.
select * from (values
  ('RLS ativa em todas as tabelas do schema public',
    not exists (select 1 from pg_tables t where t.schemaname = 'public' and not t.rowsecurity)),
  ('anon não lê nenhuma tabela de negócio',
    not exists (select 1 from information_schema.role_table_grants g where g.table_schema = 'public' and g.grantee = 'anon' and g.privilege_type = 'SELECT')),
  ('funções internas não são chamáveis por anon/authenticated (push_notification, _apply_decision, _automation_notify)',
    not has_function_privilege('anon', 'public.push_notification(uuid, uuid, text, text, text, text)', 'execute')
    and not has_function_privilege('authenticated', 'public.push_notification(uuid, uuid, text, text, text, text)', 'execute')
    and not has_function_privilege('authenticated', 'public._apply_decision(uuid, text, text, text, text, uuid)', 'execute')
    and not has_function_privilege('authenticated', 'public._automation_notify(uuid, text, uuid, text, text, text, text)', 'execute')),
  ('único acesso anônimo: aprovação por link (approval_view / approval_decide)',
    has_function_privilege('anon', 'public.approval_view(text)', 'execute') and has_function_privilege('anon', 'public.approval_decide(text, text, text, text)', 'execute')
    and not has_function_privilege('anon', 'public.request_approval(uuid, text, timestamptz, jsonb)', 'execute')
    and not has_function_privilege('anon', 'public.start_timer(uuid)', 'execute')),
  ('fila de e-mail só para service_role',
    has_function_privilege('service_role', 'public.email_queue(integer)', 'execute') and not has_function_privilege('authenticated', 'public.email_queue(integer)', 'execute')),
  ('gatilho de convite em auth.users',
    exists (select 1 from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname = 'auth' and c.relname = 'users' and t.tgname = 'on_auth_user_created')),
  ('bucket media existe e é privado',
    exists (select 1 from storage.buckets where id = 'media' and not public and file_size_limit = 52428800)),
  ('políticas do Storage para media (3)',
    (select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname like 'media_obj_%') = 3),
  ('storage.objects tem a coluna de dono usada na política de exclusão (owner_id ou owner)',
    exists (select 1 from information_schema.columns where table_schema = 'storage' and table_name = 'objects' and column_name in ('owner_id', 'owner'))),
  ('tabelas das 3 fases presentes',
    (select count(*) from information_schema.tables where table_schema = 'public' and table_name in
      ('clients', 'contracts', 'monthly_targets', 'contents', 'tasks', 'shoots', 'content_versions', 'approval_links', 'month_closings', 'media_assets', 'content_status_history', 'time_entries', 'automation_log')) = 13),
  ('RPCs principais presentes',
    (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname in
      ('bootstrap_organization', 'ensure_monthly_targets', 'close_month', 'reopen_month', 'request_approval', 'approval_decide', 'run_automations', 'start_timer', 'stop_timer', 'add_time_entry', 'portal_contents')) = 11)
) as t(verificacao, ok) order by ok, verificacao;

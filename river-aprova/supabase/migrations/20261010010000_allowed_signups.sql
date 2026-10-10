-- Lista de e-mails pré-aprovados pelo admin (escrita só via chave de serviço).
-- O trigger de cadastro passa a consultá-la, em vez de depender de app_metadata,
-- que a API administrativa pode gravar só depois do INSERT.
create table if not exists public.allowed_signups (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.allowed_signups enable row level security;
revoke all on public.allowed_signups from anon, authenticated;

create or replace function public.restrict_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'riiveragency@gmail.com'
     or exists (select 1 from public.allowed_signups where email = lower(new.email)) then
    return new;
  end if;
  raise exception 'Cadastro não permitido. Solicite acesso à River Agency.';
end;
$$;

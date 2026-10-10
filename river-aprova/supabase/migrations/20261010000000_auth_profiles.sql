-- River Aprova — etapa 1: perfis, papéis e cadastro restrito.

create type public.app_role as enum ('admin', 'cliente');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text,
  role public.app_role not null default 'cliente',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Evita recursão de RLS ao checar se o usuário atual é admin.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

-- Cada usuário lê só o próprio perfil; admin lê todos.
-- Sem políticas de INSERT/UPDATE/DELETE: ninguém altera papéis pelo cliente.
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = auth.uid());

create policy "profiles_select_admin" on public.profiles
  for select to authenticated using (public.is_admin());

revoke all on public.profiles from anon;
revoke insert, update, delete on public.profiles from authenticated;
revoke execute on function public.is_admin() from anon, public;
grant execute on function public.is_admin() to authenticated;

-- Bloqueia cadastro público: só o e-mail do admin, ou contas criadas pelo admin
-- via API administrativa (app_metadata.created_by_admin, que o cadastro público
-- não consegue definir).
create or replace function public.restrict_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(new.email) = 'riiveragency@gmail.com'
     or coalesce(new.raw_app_meta_data ->> 'created_by_admin', '') = 'true' then
    return new;
  end if;
  raise exception 'Cadastro não permitido. Solicite acesso à River Agency.';
end;
$$;

create trigger restrict_signup_before_insert
  before insert on auth.users
  for each row execute function public.restrict_signup();

-- Cria o perfil automaticamente; apenas o e-mail do admin recebe o papel admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(new.email),
    new.raw_user_meta_data ->> 'full_name',
    case when lower(new.email) = 'riiveragency@gmail.com'
         then 'admin'::public.app_role else 'cliente'::public.app_role end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Imita o mínimo do Supabase para dar para testar o schema localmente.
create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key,
  email text,
  raw_user_meta_data jsonb default '{}'::jsonb
);

-- No Supabase, auth.uid() lê o "sub" do token JWT.
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end;
$$;

grant usage on schema auth to anon, authenticated;
grant select on auth.users to authenticated;

-- Colunas do auth.users do Supabase que o Staff (migração 23) usa.
alter table auth.users add column if not exists created_at timestamptz default now();
alter table auth.users add column if not exists email_confirmed_at timestamptz default now();
alter table auth.users add column if not exists last_sign_in_at timestamptz;
alter table auth.users add column if not exists deleted_at timestamptz;

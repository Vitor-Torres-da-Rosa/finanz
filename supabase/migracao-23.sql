-- Migração 23: Staff (usuários cadastrados e ativos)
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê (pedido do Vitor em 26/11/2026): uma área "Staff", só para ele,
-- com quantas pessoas têm conta e quantas estão ativas. Ativa é a conta
-- que abriu o app nos últimos 7 dias (só abrir para olhar já conta).
--
-- O que guarda: uma linha por conta, com a data e a hora da ÚLTIMA vez que
-- o app abriu. Sem histórico e sem nada do que a pessoa viu ou fez. A linha
-- some junto com a conta.
--
-- Quem é staff: a tabela staff guarda o SHA-256 do e-mail (o e-mail não
-- fica escrito no repositório, que é público). Só conta com e-mail
-- confirmado. A trava é aqui no banco: esconder o botão no app não basta.

create table if not exists public.atividade (
  user_id  uuid        primary key references auth.users (id) on delete cascade,
  visto_em timestamptz not null default now()
);
alter table public.atividade enable row level security;
-- Sem políticas: ninguém lê nem escreve direto. Só as funções abaixo.
revoke all on public.atividade from anon, authenticated;

create table if not exists public.staff (
  email_hash text primary key check (email_hash ~ '^[0-9a-f]{64}$')
);
alter table public.staff enable row level security;
revoke all on public.staff from anon, authenticated;

insert into public.staff (email_hash)
values ('79ea2468081f90f1639aa922f43111be1195017ce9a8475196e700975d807e93')
on conflict do nothing;

create or replace function public.sou_staff()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
      from auth.users u
      join public.staff s on s.email_hash = encode(sha256(convert_to(lower(u.email), 'UTF8')), 'hex')
     where u.id = auth.uid()
       and u.email_confirmed_at is not null
  );
$$;
revoke all on function public.sou_staff() from public;

-- O app chama ao abrir (e ao voltar para ele). Grava só a hora, e no
-- máximo uma vez a cada 10 minutos. Devolve se a conta é staff, para o app
-- saber se mostra a linha em Mais.
create or replace function public.marcar_atividade()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return jsonb_build_object('staff', false);
  end if;
  insert into public.atividade (user_id, visto_em)
  values (auth.uid(), now())
  on conflict (user_id) do update
     set visto_em = excluded.visto_em
   where public.atividade.visto_em < now() - interval '10 minutes';
  return jsonb_build_object('staff', public.sou_staff());
end;
$$;
revoke all on function public.marcar_atividade() from public;
grant execute on function public.marcar_atividade() to authenticated;

-- Só números, nunca quem é quem. Para quem não é staff, recusa.
-- Ativa: a última abertura do app (ou o último login) nos últimos 7 dias.
create or replace function public.staff_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  r jsonb;
begin
  if not public.sou_staff() then
    raise exception 'só para a equipe do Finanz' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'cadastrados', count(*),
    'confirmados', count(*) filter (where u.email_confirmed_at is not null),
    'ativos_1',    count(*) filter (where greatest(a.visto_em, u.last_sign_in_at) >= now() - interval '1 day'),
    'ativos_7',    count(*) filter (where greatest(a.visto_em, u.last_sign_in_at) >= now() - interval '7 days'),
    'ativos_30',   count(*) filter (where greatest(a.visto_em, u.last_sign_in_at) >= now() - interval '30 days'),
    'novos_7',     count(*) filter (where u.created_at >= now() - interval '7 days'),
    'novos_30',    count(*) filter (where u.created_at >= now() - interval '30 days'),
    'com_senha',   (select count(*) from public.perfis p where p.cofre is not null),
    'agora',       now()
  ) into r
    from auth.users u
    left join public.atividade a on a.user_id = u.id
   where u.deleted_at is null;
  return r;
end;
$$;
revoke all on function public.staff_resumo() from public;
grant execute on function public.staff_resumo() to authenticated;

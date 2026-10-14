-- Migração 07: o pulso que prova atividade no banco
--
-- Rode este arquivo no SQL Editor de um projeto que já existe. Num
-- projeto novo não precisa: o schema.sql já traz isto no fim.
-- Pode ser rodado mais de uma vez sem quebrar nada.
--
-- Por quê: o plano gratuito pausa o projeto depois de uma semana sem
-- atividade. A ronda diária do GitHub Actions existe para evitar isso,
-- mas até aqui ela fazia uma leitura que o RLS recusa com 401 — e
-- pedido recusado é prova duvidosa de atividade; há relatos de que
-- leitura recusada não conta.
--
-- Esta função tira a dúvida: é uma escrita de verdade, mínima, que
-- carimba a hora numa linha só. O anônimo pode executá-la, mas não
-- alcança a tabela: ela não tem privilégio nenhum para anon nem para
-- authenticated, e ainda tem RLS ligada sem política. Quem escreve é a
-- função, com o dono dela.
--
-- Repare no "enable" sem "force": com force, nem o dono escapa do RLS,
-- e a própria função ficaria sem conseguir escrever. Aqui a tranca é o
-- privilégio, não a política.
--
-- Não há dado de ninguém nesta tabela. É um relógio.

create table if not exists public.pulso (
  id int primary key default 1 check (id = 1),
  em timestamptz not null default now()
);

insert into public.pulso (id, em) values (1, now())
  on conflict (id) do nothing;

alter table public.pulso enable row level security;

revoke all on table public.pulso from anon, authenticated;

create or replace function public.pulso_bater()
returns timestamptz
language sql
security definer
set search_path = public
as $$
  update public.pulso set em = now() where id = 1 returning em;
$$;

revoke all on function public.pulso_bater() from public;
grant execute on function public.pulso_bater() to anon, authenticated;

-- Aperto de mão leve, enquanto estamos aqui: função no Postgres nasce
-- com execute liberado para PUBLIC, e anon herda de PUBLIC. O schema
-- revogava "from anon", o que não tira nada. As duas de gatilho são as
-- nossas, e o motor já recusa chamá-las fora de um gatilho, então isto
-- é cinto além do suspensório. O gatilho continua disparando depois.
-- Em "do" com teste de existência porque revoke numa função que não
-- existe aborta o arquivo inteiro, e este arquivo é colado no painel.
do $$
begin
  if to_regprocedure('public.marcar_atualizacao()') is not null then
    execute 'revoke all on function public.marcar_atualizacao() from public';
  end if;
  if to_regprocedure('public.criar_perfil()') is not null then
    execute 'revoke all on function public.criar_perfil() from public';
  end if;
end;
$$;

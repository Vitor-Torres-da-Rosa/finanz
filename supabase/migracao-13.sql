-- Migração 13: Uber e Corridas, Distribuição de Doces
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê: a partir da 5.30.0 o Empreendedor tem dois módulos novos —
-- Uber e Corridas (jornadas, corridas, abastecimentos, despesas) e
-- Distribuição de Doces (vendedores, produtos, entregas, acertos,
-- pagamentos). Em vez de uma tabela para cada lista, uma tabela só: cada
-- linha diz de que lista é (tipo) e leva os campos em `dados`. Lista nova
-- no app não precisa de migração.
--
-- Sem esta tabela o app continua funcionando: os dados desses módulos
-- ficam guardados no aparelho e sobem sozinhos assim que ela existir.

create table if not exists public.empreendedor_registros (
  id            text        primary key,
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tipo          text        not null check (length(tipo) between 1 and 40),
  dados         jsonb       not null default '{}'
                            check (jsonb_typeof(dados) = 'object' and octet_length(dados::text) <= 20000),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);

create index if not exists idx_empreendedor_registros_user
  on public.empreendedor_registros (user_id, atualizado_em);

-- RLS já na criação: cada um vê e mexe só no que é seu.
alter table public.empreendedor_registros enable row level security;
alter table public.empreendedor_registros force row level security;
drop policy if exists dono_empreendedor_registros on public.empreendedor_registros;
create policy dono_empreendedor_registros on public.empreendedor_registros
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on public.empreendedor_registros from anon;
grant select, insert, update, delete on public.empreendedor_registros to authenticated;

drop trigger if exists tg_atualizacao on public.empreendedor_registros;
create trigger tg_atualizacao before update on public.empreendedor_registros
  for each row execute function public.marcar_atualizacao();

-- O carimbo passa a enxergar a tabela nova: mexer numa corrida noutro
-- aparelho também conta como "mudou alguma coisa lá".
create or replace function public.carimbo_da_conta()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select max(em) from (
    select max(atualizado_em) as em from public.perfis
    union all select max(atualizado_em) from public.contas
    union all select max(atualizado_em) from public.lancamentos
    union all select max(atualizado_em) from public.ativos
    union all select max(atualizado_em) from public.ativo_historico
    union all select max(atualizado_em) from public.clientes
    union all select max(atualizado_em) from public.servicos
    union all select max(atualizado_em) from public.pagamentos
    union all select max(atualizado_em) from public.parcelas
    union all select max(atualizado_em) from public.metas
    union all select max(atualizado_em) from public.orcamentos
    union all select max(atualizado_em) from public.empreendedor_registros
  ) t;
$$;

revoke all on function public.carimbo_da_conta() from public;
grant execute on function public.carimbo_da_conta() to authenticated;

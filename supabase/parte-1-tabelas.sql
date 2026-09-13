-- ============================================================
-- Caixa — parte 1 de 3: funcoes, perfil, contas e lancamentos
--
-- Rode as tres partes NA ORDEM, uma de cada vez, no SQL Editor.
-- Cada uma pode ser rodada de novo sem quebrar nada.
-- ============================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------
-- Funções auxiliares
-- ------------------------------------------------------------

-- Mantém atualizado_em sempre em dia. É o que a sincronização usa
-- para saber o que mudou desde a última vez.
create or replace function public.marcar_atualizacao()
returns trigger
language plpgsql
as $$
begin
  new.atualizado_em = now();
  return new;
end;
$$;

-- Cria o perfil assim que a pessoa se cadastra (e-mail, Google, etc).
create or replace function public.criar_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.perfis (id, nome)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- ------------------------------------------------------------
-- Perfil
-- ------------------------------------------------------------

create table if not exists public.perfis (
  id                    uuid primary key references auth.users (id) on delete cascade,
  nome                  text        not null default '',
  telefone              text        not null default '',
  reserva_meses         smallint    not null default 6  check (reserva_meses between 1 and 24),
  idade_atual           smallint    not null default 30 check (idade_atual between 14 and 100),
  idade_aposentadoria   smallint    not null default 60 check (idade_aposentadoria between 15 and 110),
  aporte_mensal         bigint      not null default 0  check (aporte_mensal >= 0),
  rendimento_anual      numeric(5,2) not null default 8 check (rendimento_anual between 0 and 60),
  orcamento_geral       bigint      not null default 0  check (orcamento_geral >= 0),
  objetivos             text[]      not null default '{}',
  criado_em             timestamptz not null default now(),
  atualizado_em         timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Contas do usuário (Nubank, Itaú, carteira...)
-- ------------------------------------------------------------

create table if not exists public.contas (
  id            text        primary key,
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  nome          text        not null check (length(nome) between 1 and 40),
  tipo          text        not null default 'Conta corrente',
  saldo_inicial bigint      not null default 0,
  cor           text        not null default '#E9B44C',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);

-- ------------------------------------------------------------
-- Lançamentos: entradas, saídas e transferências
-- ------------------------------------------------------------

create table if not exists public.lancamentos (
  id                text        primary key,
  user_id           uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tipo              text        not null check (tipo in ('entrada', 'saida', 'transferencia')),
  valor             bigint      not null check (valor > 0),
  descricao         text        not null default '',
  categoria         text        not null default 'Outros',
  subcategoria      text        not null default '',
  data              date        not null,
  conta_id          text        references public.contas (id) on delete set null,
  conta_destino_id  text        references public.contas (id) on delete set null,
  criado_em         timestamptz not null default now(),
  atualizado_em     timestamptz not null default now(),
  excluido_em       timestamptz,
  -- Transferência precisa de duas contas diferentes.
  constraint transferencia_valida check (
    tipo <> 'transferencia'
    or (conta_destino_id is not null and conta_destino_id is distinct from conta_id)
  )
);

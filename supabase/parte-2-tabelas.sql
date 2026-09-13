-- ============================================================
-- Caixa — parte 2 de 3: investimentos, metas, orcamento e clientes
--
-- Rode as tres partes NA ORDEM, uma de cada vez, no SQL Editor.
-- Cada uma pode ser rodada de novo sem quebrar nada.
-- ============================================================

-- ------------------------------------------------------------
-- Investimentos
-- ------------------------------------------------------------

create table if not exists public.ativos (
  id            text        primary key,
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  nome          text        not null check (length(nome) between 1 and 50),
  classe        text        not null default 'Outros',
  aplicado      bigint      not null default 0 check (aplicado >= 0),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);

create table if not exists public.ativo_historico (
  id            text        primary key,
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  ativo_id      text        not null references public.ativos (id) on delete cascade,
  data          date        not null,
  valor         bigint      not null check (valor >= 0),
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz,
  unique (ativo_id, data)
);

-- ------------------------------------------------------------
-- Metas e orçamento
-- ------------------------------------------------------------

create table if not exists public.metas (
  id            text        primary key,
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  nome          text        not null check (length(nome) between 1 and 50),
  alvo          bigint      not null check (alvo > 0),
  guardado      bigint      not null default 0 check (guardado >= 0),
  prazo         date,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);

create table if not exists public.orcamentos (
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  categoria     text        not null check (length(categoria) between 1 and 30),
  valor         bigint      not null check (valor >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, categoria)
);

create table if not exists public.categorias_extras (
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tipo          text        not null check (tipo in ('entrada', 'saida')),
  nome          text        not null check (length(nome) between 1 and 30),
  criado_em     timestamptz not null default now(),
  primary key (user_id, tipo, nome)
);

create table if not exists public.subcategorias_extras (
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tipo          text        not null check (tipo in ('entrada', 'saida')),
  categoria     text        not null check (length(categoria) between 1 and 30),
  nome          text        not null check (length(nome) between 1 and 30),
  criado_em     timestamptz not null default now(),
  primary key (user_id, tipo, categoria, nome)
);

-- ------------------------------------------------------------
-- Empreendedor: clientes, serviços e pagamentos
-- ------------------------------------------------------------

create table if not exists public.clientes (
  id                 text        primary key,
  user_id            uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  nome               text        not null check (length(nome) between 1 and 60),
  telefone           text        not null default '',
  obs                text        not null default '',
  proximo_pagamento  date,
  criado_em          timestamptz not null default now(),
  atualizado_em      timestamptz not null default now(),
  excluido_em        timestamptz
);

create table if not exists public.servicos (
  id            text        primary key,
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  cliente_id    text        not null references public.clientes (id) on delete cascade,
  nome          text        not null check (length(nome) between 1 and 60),
  valor         bigint      not null check (valor > 0),
  data          date        not null,
  obs           text        not null default '',
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);

create table if not exists public.pagamentos (
  id            text        primary key,
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  cliente_id    text        not null references public.clientes (id) on delete cascade,
  servico_id    text        references public.servicos (id) on delete set null,
  lancamento_id text        references public.lancamentos (id) on delete set null,
  valor         bigint      not null check (valor > 0),
  data          date        not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);

-- ------------------------------------------------------------
-- Índices
-- ------------------------------------------------------------

create index if not exists idx_contas_user            on public.contas (user_id, atualizado_em);
create index if not exists idx_lancamentos_user       on public.lancamentos (user_id, atualizado_em);
create index if not exists idx_lancamentos_user_data  on public.lancamentos (user_id, data desc);
create index if not exists idx_lancamentos_conta      on public.lancamentos (conta_id);
create index if not exists idx_ativos_user            on public.ativos (user_id, atualizado_em);
create index if not exists idx_historico_user         on public.ativo_historico (user_id, ativo_id, data);
create index if not exists idx_metas_user             on public.metas (user_id, atualizado_em);
create index if not exists idx_clientes_user          on public.clientes (user_id, atualizado_em);
create index if not exists idx_servicos_user          on public.servicos (user_id, cliente_id);
create index if not exists idx_pagamentos_user        on public.pagamentos (user_id, cliente_id);

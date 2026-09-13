-- ============================================================
-- Caixa — esquema e segurança para Supabase
--
-- Rode este arquivo inteiro no SQL Editor do painel do Supabase.
-- Ele pode ser rodado mais de uma vez sem quebrar nada.
--
-- Regra central: toda tabela tem user_id e Row Level Security
-- ligada. O Postgres só devolve as linhas de quem está logado,
-- mesmo que o aplicativo peça outra coisa.
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
  inflacao_anual        numeric(5,2) not null default 4 check (inflacao_anual between 0 and 40),
  retirada_anual        numeric(5,2) not null default 4 check (retirada_anual between 0 and 20),
  meta_patrimonio       bigint      not null default 0  check (meta_patrimonio >= 0),
  conta_aposentadoria   text,
  reserva_ligada        boolean     not null default true,
  reserva_conta         text,
  reserva_manual        bigint      not null default 0  check (reserva_manual >= 0),
  tipos_registro        text[]      not null default '{}',
  regras_categoria jsonb  not null default '{}'::jsonb,
  pares_ignorados  jsonb  not null default '[]'::jsonb,
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
  banco         text        not null default '',
  fechamento    smallint    not null default 0,
  vencimento    smallint    not null default 0,
  limite        bigint      not null default 0,
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
  conta_id      text        references public.contas (id) on delete set null,
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
  whatsapp           boolean     not null default true,
  telefones          jsonb       not null default '[]',
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
  tipo          text        not null default 'Serviço',
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
  parcela_id    text,
  lancamento_id text        references public.lancamentos (id) on delete set null,
  valor         bigint      not null check (valor > 0),
  data          date        not null,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  excluido_em   timestamptz
);

-- Parcelas combinadas com o cliente: o que vence, quando e quanto.
create table if not exists public.parcelas (
  id            text        primary key,
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  cliente_id    text        not null references public.clientes (id) on delete cascade,
  servico_id    text        references public.servicos (id) on delete set null,
  pagamento_id  text        references public.pagamentos (id) on delete set null,
  numero        smallint    not null check (numero >= 1),
  total         smallint    not null check (total >= 1),
  valor         bigint      not null check (valor > 0),
  vencimento    date        not null,
  minimo        bigint      not null default 0 check (minimo >= 0),
  juros_atraso  numeric(5,2) not null default 0 check (juros_atraso between 0 and 100),
  quitada_em    date,
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
create index if not exists idx_parcelas_user         on public.parcelas (user_id, cliente_id, vencimento);
create index if not exists idx_pagamentos_parcela     on public.pagamentos (user_id, parcela_id);

-- ------------------------------------------------------------
-- Row Level Security
--
-- É aqui que mora o isolamento entre usuários. Sem estas linhas,
-- qualquer pessoa com a chave pública leria os dados de todo mundo.
-- ------------------------------------------------------------

do $$
declare
  t text;
  tabelas text[] := array[
    'contas', 'lancamentos', 'ativos', 'ativo_historico', 'metas',
    'orcamentos', 'categorias_extras', 'subcategorias_extras', 'clientes', 'servicos', 'pagamentos', 'parcelas'
  ];
begin
  -- Perfil: a chave é a própria id do usuário.
  execute 'alter table public.perfis enable row level security';
  execute 'alter table public.perfis force row level security';
  execute 'drop policy if exists perfil_proprio on public.perfis';
  execute $p$
    create policy perfil_proprio on public.perfis
      for all to authenticated
      using (id = (select auth.uid()))
      with check (id = (select auth.uid()))
  $p$;

  -- Demais tabelas: a chave é user_id.
  foreach t in array tabelas loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists %I on public.%I', 'dono_' || t, t);
    execute format($p$
      create policy %I on public.%I
        for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $p$, 'dono_' || t, t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Gatilhos de atualizado_em
-- ------------------------------------------------------------

do $$
declare
  t text;
  tabelas text[] := array[
    'perfis', 'contas', 'lancamentos', 'ativos', 'ativo_historico', 'metas',
    'orcamentos', 'clientes', 'servicos', 'pagamentos', 'parcelas'
  ];
begin
  foreach t in array tabelas loop
    execute format('drop trigger if exists tg_atualizacao on public.%I', t);
    execute format(
      'create trigger tg_atualizacao before update on public.%I
         for each row execute function public.marcar_atualizacao()', t);
  end loop;
end;
$$;

-- Perfil criado junto com o usuário
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ------------------------------------------------------------
-- Permissões
--
-- anon é o papel de quem não fez login. Ele não precisa de nada
-- aqui: cadastro e login passam pelo serviço de autenticação,
-- não por estas tabelas.
-- ------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Repare que não damos privilégio automático para tabelas futuras. Isso é
-- de propósito: combina com a opção "Automatically expose new tables"
-- desligada no projeto. Tabela nova só entra na API depois de um grant
-- explícito, feito de olho no que ela guarda.

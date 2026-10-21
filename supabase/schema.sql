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
  importacoes      jsonb  not null default '[]'::jsonb,
  propostas        jsonb  not null default '[]'::jsonb,
  revisados        jsonb  not null default '{}'::jsonb,
  taxas            jsonb  not null default '{}'::jsonb,
  negocio          text   not null default '',
  contato          text   not null default '',
  meta_economia    smallint not null default 20,
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
  importacao_id     text        not null default '',
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
  endereco           text        not null default '',
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
alter default privileges in schema public revoke all on tables from anon;

-- Função no Postgres nasce com execute liberado para PUBLIC, e anon
-- herda de PUBLIC. Por isso revogar "from anon" não adianta nada aqui:
-- tem de ser "from public". As duas de gatilho são as nossas; o motor
-- já recusa chamá-las fora de um gatilho ("trigger functions can only
-- be called as triggers"), então isto é cinto além do suspensório.
-- Conferido que o gatilho de atualizado_em continua disparando depois.
revoke all on function public.marcar_atualizacao() from public;
revoke all on function public.criar_perfil() from public;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Repare que não damos privilégio automático para tabelas futuras. Isso é
-- de propósito: combina com a opção "Automatically expose new tables"
-- desligada no projeto. Tabela nova só entra na API depois de um grant
-- explícito, feito de olho no que ela guarda.

-- ------------------------------------------------------------
-- Instantâneos: o estado inteiro, um por dia, por conta
--
-- `dados` é o JSON do estado comprimido (gzip) e em base64. Comprimido
-- porque o estado de quem usa o app há um ano passa de meio mega em
-- texto, e são catorze deles por conta.
--
-- A chave (user_id, dia) é o que faz "um por dia": o app grava com
-- on_conflict e o segundo do mesmo dia só atualiza o primeiro.
--
-- Esta tabela NÃO entra na sincronização. Ela é lida sob demanda, na
-- tela de recuperar — baixar catorze estados inteiros a cada sincronia
-- seria mover megabytes para nada.
-- ------------------------------------------------------------

create table if not exists public.instantaneos (
  id        text        primary key,
  user_id   uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  dia       date        not null,
  resumo    text        not null default '',
  dados     text        not null,
  tamanho   integer     not null default 0 check (tamanho >= 0),
  criado_em timestamptz not null default now(),
  unique (user_id, dia)
);

create index if not exists idx_instantaneos_user on public.instantaneos (user_id, dia desc);

-- ------------------------------------------------------------
-- Arquivos de extrato: o PDF, o OFX, o CSV, como o banco entregou
--
-- `conteudo` é o arquivo em base64. `importacao_id` liga de volta à
-- leva de lançamentos que saiu dele, que é o que a folha de Conferir
-- já usa para desfazer uma importação inteira.
--
-- Também fica fora da sincronização, e pela mesma razão: a lista mostra
-- só nome, tamanho e data, e o arquivo só desce quando alguém pede.
-- ------------------------------------------------------------

create table if not exists public.arquivos_extrato (
  id            text        primary key,
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  importacao_id text        not null default '',
  -- Sem chave estrangeira de propósito. O arquivo sobe no mesmo instante em
  -- que a importação acontece, e a conta pode ter nascido ali, segundos
  -- antes de a sincronização levá-la para o servidor: a chave recusava o
  -- arquivo por uma questão de ordem. Aqui conta_id é etiqueta, não
  -- vínculo — quem amarra o arquivo ao que ele gerou é importacao_id.
  conta_id      text        not null default '',
  nome          text        not null default '',
  tipo          text        not null default '',
  tamanho       integer     not null default 0 check (tamanho >= 0),
  conteudo      text        not null,
  criado_em     timestamptz not null default now()
);

create index if not exists idx_arquivos_user on public.arquivos_extrato (user_id, criado_em desc);
create index if not exists idx_arquivos_importacao on public.arquivos_extrato (importacao_id);

-- ------------------------------------------------------------
-- Segurança: mesma regra das outras tabelas
--
-- `force` porque aqui também vale para o dono da tabela: ninguém
-- alcança linha que não seja sua, nem por engano de código.
-- ------------------------------------------------------------

do $$
declare
  t text;
  tabelas text[] := array['instantaneos', 'arquivos_extrato'];
begin
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

-- O projeto está com "Automatically expose new tables" desligado, então
-- tabela nova só entra na API com grant explícito. Estes são de olho no
-- que elas guardam: o dono lê, escreve e apaga as suas; o anônimo não
-- alcança nada.
grant select, insert, update, delete on public.instantaneos      to authenticated;
grant select, insert, update, delete on public.arquivos_extrato  to authenticated;
revoke all on table public.instantaneos     from anon;
revoke all on table public.arquivos_extrato from anon;

-- ------------------------------------------------------------
-- Pulso: a batida que prova atividade no banco
--
-- O plano gratuito pausa o projeto depois de uma semana sem
-- atividade. A ronda diária do GitHub Actions existe para evitar
-- isso, mas até aqui ela fazia uma leitura que o RLS recusa com
-- 401 — e pedido recusado é prova duvidosa de atividade; há
-- relatos de que leitura recusada não conta.
--
-- Esta função tira a dúvida: é uma escrita de verdade, mínima,
-- que carimba a hora numa linha só. O anônimo pode executá-la,
-- mas não alcança a tabela: ela não tem privilégio nenhum para
-- anon nem para authenticated, e ainda tem RLS ligada sem
-- política. Quem escreve é a função, com o dono dela.
--
-- Repare no "enable" sem "force": com force, nem o dono escapa
-- do RLS, e a própria função ficaria sem conseguir escrever.
-- Aqui a tranca é o privilégio, não a política.
--
-- Não há dado de ninguém nesta tabela. É um relógio.
-- ------------------------------------------------------------

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

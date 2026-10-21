-- Migração 08: a volta no tempo e os arquivos de extrato
--
-- Rode este arquivo no SQL Editor de um projeto que já existe. Num
-- projeto novo não precisa: o schema.sql já traz isto.
-- Pode ser rodado mais de uma vez sem quebrar nada.
--
-- Por quê: até aqui, se os dados entrassem errados não havia volta. O
-- backup existia, mas era um arquivo que alguém precisava lembrar de
-- gerar e guardar — e ninguém lembra antes de precisar. Em outubro de
-- 2026 um cofre trazido de outra conta somou com o que já estava na
-- nuvem, e as contas do Vitor dobraram de valor. O conserto daquele
-- defeito está no app; isto aqui é a rede embaixo: todo dia, sozinho, o
-- app guarda o estado inteiro na nuvem, e dá para voltar a qualquer dia
-- das últimas duas semanas.
--
-- E os arquivos de extrato passam a ficar guardados como vieram do
-- banco. Se a leitura sair errada, dá para reler o original em vez de
-- caçar o PDF no celular meses depois.

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

-- Quem rodou a primeira versão desta migração tem a chave estrangeira.
-- Ela recusa arquivo de conta que ainda não sincronizou, então sai.
alter table public.arquivos_extrato
  drop constraint if exists arquivos_extrato_conta_id_fkey;
alter table public.arquivos_extrato
  alter column conta_id set default '';
update public.arquivos_extrato set conta_id = '' where conta_id is null;
alter table public.arquivos_extrato
  alter column conta_id set not null;

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

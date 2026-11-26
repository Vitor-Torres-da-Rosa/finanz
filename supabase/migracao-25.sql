-- Migração 25: sem a senha dos dados, nada fica aberto no servidor
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê (pedido do Vitor em 26/11/2026): sem a senha dos dados, a
-- sincronização não funciona, e o que já estava no servidor sem cifra é
-- apagado. Com a senha, tudo continua indo cifrado (tabela cofre).
--
-- O cuidado com versões antigas do app: elas, vendo o servidor VAZIO,
-- trocariam os dados do celular pelo vazio. Por isso as tabelas antigas
-- não ficam só vazias: ficam FECHADAS. Ler ou gravar nelas devolve
-- "permissão negada" (403), a versão antiga mostra "Não está
-- sincronizando" e não mexe no que está no celular.
--
-- O que muda:
--   1. contas, lancamentos, ativos, ativo_historico, clientes, servicos,
--      pagamentos, parcelas, metas, orcamentos, categorias_extras e
--      subcategorias_extras: tudo apagado e a tabela fechada para o app.
--      (Quem tem a senha já não usa nenhuma delas: está tudo no cofre.)
--   2. perfis: os campos abertos voltam ao padrão, e um gatilho mantém
--      assim. Fica só o que o app precisa: o id e o cofre (a chave
--      embrulhada pela senha).
--   3. arquivos_extrato: fica só o que está cifrado (cofre1: ou a versão
--      conferida, que já sai cifrada). O resto é apagado, e o banco recusa
--      arquivo aberto daqui para a frente.
--   4. empreendedor_registros: fica só o compartilhado cifrado ({"c": …}).
--      O resto é apagado, e o banco recusa registro aberto.
--   5. carimbo_da_conta: passa a olhar só as tabelas que continuam em uso.

-- 1. Tabelas antigas: apaga e fecha.
-- Todas de uma vez (truncate): elas se apontam umas para as outras, e
-- apagar uma por uma esbarra nas chaves e nas regras entre elas.
do $$
declare
  t text;
  lista text := '';
begin
  foreach t in array array['contas', 'lancamentos', 'ativos', 'ativo_historico', 'clientes',
                           'servicos', 'pagamentos', 'parcelas', 'metas', 'orcamentos',
                           'categorias_extras', 'subcategorias_extras']
  loop
    if to_regclass('public.' || t) is not null then
      lista := lista || case when lista = '' then '' else ', ' end || format('public.%I', t);
      execute format('revoke all on public.%I from anon, authenticated', t);
    end if;
  end loop;
  if lista <> '' then
    execute 'truncate table ' || lista;
  end if;
end $$;

-- 2. perfis: só o id e o cofre carregam algo.
create or replace function public.perfil_sempre_neutro()
returns trigger
language plpgsql
as $$
begin
  new.nome := '';
  new.telefone := '';
  new.reserva_meses := 6;
  new.idade_atual := 30;
  new.idade_aposentadoria := 60;
  new.aporte_mensal := 0;
  new.rendimento_anual := 8;
  new.orcamento_geral := 0;
  new.objetivos := '{}';
  new.inflacao_anual := 4;
  new.retirada_anual := 4;
  new.meta_patrimonio := 0;
  new.conta_aposentadoria := null;
  new.reserva_ligada := true;
  new.reserva_conta := null;
  new.reserva_manual := 0;
  new.tipos_registro := '{}';
  new.regras_categoria := '{}'::jsonb;
  new.pares_ignorados := '[]'::jsonb;
  new.importacoes := '[]'::jsonb;
  new.propostas := '[]'::jsonb;
  new.revisados := '{}'::jsonb;
  new.taxas := '{}'::jsonb;
  new.negocio := '';
  new.contato := '';
  new.meta_economia := 20;
  new.ofertas_rf := '[]'::jsonb;
  return new;
end;
$$;

drop trigger if exists perfis_sempre_neutro on public.perfis;
create trigger perfis_sempre_neutro
  before insert or update on public.perfis
  for each row execute function public.perfil_sempre_neutro();

-- Passa o gatilho em todas as linhas: as abertas ficam neutras.
update public.perfis set nome = '';

-- 3. Arquivos de extrato: só cifrados.
delete from public.arquivos_extrato
 where not (conteudo like 'cofre1:%' or tipo = 'application/vnd.finanz.conferido');
alter table public.arquivos_extrato drop constraint if exists arquivos_extrato_so_cifrado;
alter table public.arquivos_extrato
  add constraint arquivos_extrato_so_cifrado
  check (conteudo like 'cofre1:%' or tipo = 'application/vnd.finanz.conferido') not valid;
alter table public.arquivos_extrato validate constraint arquivos_extrato_so_cifrado;

-- 4. Empreendedor: só o compartilhado cifrado.
delete from public.empreendedor_registros
 where not (dados ? 'c' and jsonb_typeof(dados -> 'c') = 'string');
alter table public.empreendedor_registros drop constraint if exists empreendedor_registros_so_cifrado;
alter table public.empreendedor_registros
  add constraint empreendedor_registros_so_cifrado
  check (dados ? 'c' and jsonb_typeof(dados -> 'c') = 'string') not valid;
alter table public.empreendedor_registros validate constraint empreendedor_registros_so_cifrado;

-- 5. O carimbo olha só o que continua em uso.
create or replace function public.carimbo_da_conta()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select max(em) from (
    select max(atualizado_em) as em from public.perfis
    union all select max(atualizado_em) from public.empreendedor_registros
    union all select max(atualizado_em) from public.cofre
  ) t;
$$;
revoke all on function public.carimbo_da_conta() from public;
grant execute on function public.carimbo_da_conta() to authenticated;

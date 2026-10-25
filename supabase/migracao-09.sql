-- Migração 09: o carimbo da conta
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê: toda sincronização baixava o conjunto inteiro de dados, mesmo
-- quando nada tinha mudado no servidor desde a última. Medido em
-- 25/10/2026 numa conta com 1000 lançamentos: 389 KB por sincronização,
-- vinte a cinquenta vezes por dia, por pessoa. É o que limitava o servidor
-- a umas cem contas — não o espaço em disco, o tráfego.
--
-- E quase sempre não mudou nada: na maioria das vezes quem mexeu foi o
-- próprio aparelho que está perguntando.
--
-- Esta função responde "qual é a alteração mais recente da minha conta?"
-- em uns trinta bytes. Igual ao que o app já tem guardado, ele pula o
-- download inteiro.
--
-- Ela também serve para o contrário, que é mais importante que economia:
-- um aparelho que ficou parado com uma cópia velha descobre, ANTES de
-- mandar, que o servidor andou — e adota o que está lá em vez de empurrar
-- o passado por cima do presente.

-- security invoker (o padrão) de propósito: a função enxerga só o que o
-- RLS deixa aquele usuário enxergar, que é exatamente o que se quer. Com
-- security definer ela veria as linhas de todo mundo e o max() vazaria o
-- movimento alheio.
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
  ) t;
$$;

revoke all on function public.carimbo_da_conta() from public;
grant execute on function public.carimbo_da_conta() to authenticated;

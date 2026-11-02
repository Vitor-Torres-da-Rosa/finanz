-- Migração 14: as despesas de cada venda ou serviço
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê: a partir da 5.32.0 cada registro (venda ou serviço) guarda o
-- que saiu do bolso para fazê-lo — o custo do produto, peças, material,
-- frete — e o painel do Empreendedor desconta isso do lucro. Uma lista
-- de {nome, valor}, em centavos.
--
-- Sem esta coluna o app continua funcionando: envia o registro sem as
-- despesas, e elas ficam guardadas no aparelho até a coluna existir.

alter table public.servicos
  add column if not exists despesas jsonb not null default '[]';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'servicos_despesas_lista') then
    alter table public.servicos
      add constraint servicos_despesas_lista check (jsonb_typeof(despesas) = 'array');
  end if;
end;
$$;

comment on column public.servicos.despesas is
  'O que saiu do bolso para este registro: lista de {nome, valor} em centavos. Desconta do lucro.';

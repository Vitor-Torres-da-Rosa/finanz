-- Migração 12: o grupo das parcelas e das repetições
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê: a partir da 5.29.0 dá para lançar uma compra parcelada (no
-- cartão ou não) e uma despesa fixa que se repete. Cada parcela continua
-- sendo um lançamento normal, na sua data e na sua fatura; o grupo só diz
-- quais andam juntas, para a pessoa poder apagar todas de uma vez.
--
-- Sem esta coluna o app continua funcionando: ele envia sem o grupo, e as
-- parcelas viram lançamentos soltos depois da próxima sincronização.

alter table public.lancamentos
  add column if not exists grupo text not null default '';

comment on column public.lancamentos.grupo is
  'Parcelas de uma compra ou repetições de uma despesa fixa: o mesmo valor junta todas. Vazio quando o lançamento é avulso.';

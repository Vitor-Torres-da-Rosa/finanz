-- Migração 16: observação em cada pagamento de cliente
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê: a partir da 5.44.0 uma parcela pode ser paga em várias vezes, e
-- cada pagamento leva uma anotação ("pix da esposa", "entrada em
-- dinheiro"). Sem esta coluna o app continua funcionando: a anotação fica
-- no aparelho.

alter table public.pagamentos
  add column if not exists obs text not null default '' check (length(obs) <= 200);

-- Migração 10: a data do outro lado da transferência
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê: quando o app junta um par de transferência — a saída de uma
-- conta com a entrada de outra —, os dois lançamentos viram UM, do tipo
-- 'transferencia'. Das duas datas sobra a da saída, porque é quando o
-- dinheiro saiu. A outra era jogada fora.
--
-- Só que o extrato da conta de DESTINO traz o dia em que o dinheiro
-- CAIU, que é justamente a data descartada. Reimportando esse extrato, a
-- checagem de repetidos não achava a transferência e oferecia lançar
-- tudo de novo. Com nove pares juntados, nove duplicatas por
-- reimportação.
--
-- Guardando a data do destino, a conferência volta a ser exata dos dois
-- lados. Fica nula quando as duas datas são iguais: aí não há informação
-- nenhuma a guardar.

alter table public.lancamentos
  add column if not exists data_destino date;

comment on column public.lancamentos.data_destino is
  'Transferência: o dia em que o dinheiro caiu na conta de destino, quando difere do dia da saída. Nulo nos demais casos.';

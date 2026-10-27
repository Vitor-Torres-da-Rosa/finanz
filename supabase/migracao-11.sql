-- Migração 11: as duas pernas de uma transferência, apontando uma para a outra
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê: até a 5.24.1, juntar um par de transferência APAGAVA os dois
-- lançamentos e criava um terceiro, do tipo 'transferencia'. O saldo das
-- contas continuava certo, mas a linha que a pessoa reconhece do extrato
-- do banco sumia: no lugar das duas ficava uma só, com a data e a
-- descrição do outro lado. Conferir o app contra o extrato do banco ficava
-- impossível, e não havia como desfazer — o outro lado não existia mais.
--
-- Agora os dois lançamentos ficam onde estão, cada um com a sua data, a
-- sua descrição e a sua conta, somando no saldo de cada uma. Ganham só uma
-- marca apontando um para o outro, e é ela que os tira de receitas e
-- despesas e os junta na aba de Transferências.
--
-- Guarda o id do outro lançamento, sem chave estrangeira de propósito: se
-- o par for apagado, a marca aponta para o nada e o app trata a perna
-- órfã como lançamento comum de novo. Melhor voltar a contar do que sumir
-- com dinheiro por causa de uma referência morta — e uma FK aqui recusaria
-- o envio inteiro quando os dois lados subissem fora de ordem.

alter table public.lancamentos
  add column if not exists par_transferencia text not null default '';

comment on column public.lancamentos.par_transferencia is
  'Transferência juntada: o id do lançamento do outro lado. Vazio quando não é uma perna de par.';

-- Migração 22: apagar as cópias antigas que estão abertas na nuvem
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê (pedido do Vitor em 25/11/2026): "apaga as cópias antigas". Desde
-- a migração 21, cópia nova só entra cifrada; esta tira as que ficaram de
-- antes, legíveis, de todas as contas. As cifradas (de quem tem a senha dos
-- dados) ficam. Depois disso a regra passa a valer para a tabela inteira.

delete from public.instantaneos where dados not like 'cofre1:%';

alter table public.instantaneos validate constraint instantaneos_so_cifrado;

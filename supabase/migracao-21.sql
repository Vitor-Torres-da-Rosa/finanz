-- Migração 21: backup na nuvem só cifrado
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê (pedido do Vitor em 25/11/2026): sem a senha dos dados, nenhum
-- backup vai para a nuvem — nem de quem ainda usa uma versão antiga do
-- app. O app novo já não manda; esta regra faz o servidor recusar qualquer
-- cópia nova que não chegue cifrada com a chave da pessoa ("cofre1:").
--
-- `not valid`: a regra vale para o que entrar daqui para a frente; as
-- cópias que já estão lá não são tocadas por ela.

alter table public.instantaneos drop constraint if exists instantaneos_so_cifrado;
alter table public.instantaneos
  add constraint instantaneos_so_cifrado check (dados like 'cofre1:%') not valid;

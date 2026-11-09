-- Migração 17: compartilhar as Contas de casa com quem divide
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê: nas Contas de casa, cada pessoa que divide as contas pode ter
-- o e-mail cadastrado. Quem tem o app recebe o convite e, aceitando, vê e
-- mexe nas mesmas contas e compras de mercado — as do dono. É o mesmo
-- compartilhamento da migração 15, com uma área a mais: os registros
-- 'casa_*' passam a ser da área 'casa'. Nenhuma tabela nova; o RLS de
-- empreendedor_registros e de compartilhamentos continua o mesmo.

create or replace function public.area_do_tipo(p_tipo text)
returns text
language sql
immutable
as $$
  select case
    when p_tipo like 'doce\_%' then 'doces'
    when p_tipo like 'uber\_%' then 'uber'
    when p_tipo like 'casa\_%' then 'casa'
    else ''
  end
$$;

-- Migração 18: ofertas de renda fixa anotadas
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê: em Investimentos, a pessoa anota as ofertas de CDB, LCI, LCA e
-- afins que vê no banco ou na corretora (banco, tipo, taxa, vencimento), e
-- o app mostra as melhores no topo. A lista mora no perfil, como as
-- importações, e o RLS do perfil (cada um só vê o seu) continua valendo.

alter table public.perfis
  add column if not exists ofertas_rf jsonb not null default '[]'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'perfis_ofertas_rf_lista') then
    alter table public.perfis
      add constraint perfis_ofertas_rf_lista check (jsonb_typeof(ofertas_rf) = 'array');
  end if;
end $$;

-- Migração 20: o compartilhado cifrado (par de chaves)
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê (pedido do Vitor em 25/11/2026): as áreas do Empreendedor
-- compartilhadas com outra pessoa (Doces, Uber, Casa) também ficam
-- cifradas de ponta a ponta.
--
-- Como: cada pessoa tem um par de chaves (a privada mora no cofre dela,
-- cifrada com a chave mestra). O convite guarda as duas chaves públicas e,
-- para cada área, a chave da área embrulhada para a pessoa convidada (só
-- ela desembrulha, com a privada dela). Os registros da área continuam em
-- empreendedor_registros — o RLS do compartilhamento segue valendo —, mas
-- o `dados` vai cifrado com a chave da área.

alter table public.compartilhamentos
  add column if not exists dono_chave_publica     text,
  add column if not exists convidado_chave_publica text,
  add column if not exists chaves                 jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'compartilhamentos_chaves_objeto') then
    alter table public.compartilhamentos
      add constraint compartilhamentos_chaves_objeto check (jsonb_typeof(chaves) = 'object');
  end if;
end $$;

-- A pessoa convidada publica a chave pública dela no convite que é dela.
-- Só isso: não mexe em mais nada do convite.
create or replace function public.publicar_minha_chave(p_id text, p_chave text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  achou integer;
begin
  update public.compartilhamentos
     set convidado_chave_publica = left(p_chave, 400)
   where id = p_id
     and (convidado_id = auth.uid() or convidado_email = public.meu_email())
     and auth.uid() is not null;
  get diagnostics achou = row_count;
  return achou > 0;
end;
$$;

revoke all on function public.publicar_minha_chave(text, text) from public;
grant execute on function public.publicar_minha_chave(text, text) to authenticated;

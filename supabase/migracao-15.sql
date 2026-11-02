-- Migração 15: compartilhar partes do Empreendedor com outra conta
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê: o Vitor e a esposa tocam juntos a Venda de Doces. Ele convida
-- pelo e-mail da conta dela, escolhe o que compartilhar (Venda de Doces,
-- Uber e Corridas), ela aceita dentro do app e os dois passam a ver e
-- mexer nos MESMOS registros — os dele. O resto da conta dele continua
-- invisível para ela, e nada da conta dela fica visível para ele.
--
-- Como a segurança fica:
--   * compartilhamentos: o dono vê e mexe nos convites que ele fez; a
--     convidada só LÊ os convites feitos para o e-mail dela. Aceitar,
--     recusar e sair passam por funções que mudam só a linha dela.
--   * empreendedor_registros: além da regra de sempre (cada um no que é
--     seu), quem aceitou um convite enxerga e edita as linhas do dono
--     daquelas áreas. Só das áreas aceitas, só enquanto o convite valer.
--   * RLS ligado e forçado na tabela nova desde a criação.

-- O e-mail de quem está logado, lido do cadastro (auth.users). Fica numa
-- função "security definer" porque o papel authenticated não lê
-- auth.users diretamente no Supabase.
create or replace function public.meu_email()
returns text
language sql
stable
security definer
set search_path = public, auth
as $$
  select lower(email) from auth.users where id = auth.uid()
$$;

revoke all on function public.meu_email() from public;
grant execute on function public.meu_email() to authenticated;

create table if not exists public.compartilhamentos (
  id              text        primary key,
  dono_id         uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  dono_nome       text        not null default '' check (length(dono_nome) <= 80),
  convidado_email text        not null check (length(convidado_email) between 3 and 200
                                              and convidado_email = lower(convidado_email)),
  convidado_id    uuid        references auth.users (id) on delete set null,
  -- As áreas compartilhadas: 'doces' e/ou 'uber'.
  areas           jsonb       not null default '[]'
                              check (jsonb_typeof(areas) = 'array' and jsonb_array_length(areas) between 1 and 4),
  situacao        text        not null default 'pendente'
                              check (situacao in ('pendente', 'aceito', 'recusado')),
  criado_em       timestamptz not null default now(),
  atualizado_em   timestamptz not null default now(),
  unique (dono_id, convidado_email)
);

alter table public.compartilhamentos enable row level security;
alter table public.compartilhamentos force row level security;

-- O dono faz, muda e desfaz os convites dele. Não pode convidar a si mesmo.
drop policy if exists dono_compartilhamentos on public.compartilhamentos;
create policy dono_compartilhamentos on public.compartilhamentos
  for all to authenticated
  using (dono_id = (select auth.uid()))
  with check (dono_id = (select auth.uid())
              and convidado_email <> coalesce((select public.meu_email()), ''));

-- A convidada só lê o que foi feito para ela.
drop policy if exists convidado_le_compartilhamentos on public.compartilhamentos;
create policy convidado_le_compartilhamentos on public.compartilhamentos
  for select to authenticated
  using (convidado_id = (select auth.uid())
         or convidado_email = (select public.meu_email()));

revoke all on public.compartilhamentos from anon;
grant select, insert, update, delete on public.compartilhamentos to authenticated;

drop trigger if exists tg_atualizacao on public.compartilhamentos;
create trigger tg_atualizacao before update on public.compartilhamentos
  for each row execute function public.marcar_atualizacao();

-- De que área é cada tipo de registro.
create or replace function public.area_do_tipo(p_tipo text)
returns text
language sql
immutable
as $$
  select case
    when p_tipo like 'doce\_%' then 'doces'
    when p_tipo like 'uber\_%' then 'uber'
    else ''
  end
$$;

-- Quem está logado aceitou um convite deste dono para esta área?
-- "security definer" para a regra da tabela de registros poder olhar os
-- convites sem cair nas regras da tabela de convites.
create or replace function public.compartilhado_comigo(p_dono uuid, p_tipo text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.compartilhamentos c
     where c.dono_id = p_dono
       and c.convidado_id = auth.uid()
       and c.situacao = 'aceito'
       and c.areas ? public.area_do_tipo(p_tipo)
  )
$$;

revoke all on function public.compartilhado_comigo(uuid, text) from public;
grant execute on function public.compartilhado_comigo(uuid, text) to authenticated;

-- Nas áreas aceitas, a convidada lê e edita os registros do dono — e só
-- grava linhas que continuam sendo do dono, daquela área.
drop policy if exists compartilhado_empreendedor_registros on public.empreendedor_registros;
create policy compartilhado_empreendedor_registros on public.empreendedor_registros
  for all to authenticated
  using (public.compartilhado_comigo(user_id, tipo))
  with check (public.compartilhado_comigo(user_id, tipo));

-- Aceitar ou recusar: muda só a situação e quem aceitou, e só num convite
-- feito para o e-mail de quem chama.
create or replace function public.responder_convite(p_id text, p_aceitar boolean)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  achou integer;
begin
  update public.compartilhamentos
     set situacao = case when p_aceitar then 'aceito' else 'recusado' end,
         convidado_id = case when p_aceitar then auth.uid() else null end
   where id = p_id
     and convidado_email = public.meu_email()
     and auth.uid() is not null;
  get diagnostics achou = row_count;
  return achou > 0;
end;
$$;

revoke all on function public.responder_convite(text, boolean) from public;
grant execute on function public.responder_convite(text, boolean) to authenticated;

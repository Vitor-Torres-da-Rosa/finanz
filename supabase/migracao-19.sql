-- Migração 19: o cofre da criptografia de ponta a ponta
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê (pedido do Vitor em 25/11/2026): ninguém além da própria pessoa
-- pode ler os dados dela, nem quem administra o servidor. Com o cofre, o
-- celular cifra cada registro com a chave mestra da pessoa antes de mandar;
-- aqui chega só o texto embaralhado.
--
-- O que o servidor ainda vê, e só isso: de quem é a linha, de que tipo ela
-- é (lancamentos, contas…), quando mudou e o tamanho. Valores, descrições,
-- nomes e categorias ficam ilegíveis.
--
-- A chave mestra mora em perfis.cofre, embrulhada pela "senha dos dados"
-- (PBKDF2 + AES-GCM). A senha nunca sai do celular. Esqueceu a senha, a
-- chave não abre — nem aqui, nem no painel.

create table if not exists public.cofre (
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  -- "<tabela>|<chave do registro>": o mesmo registro cai sempre na mesma linha.
  id            text        not null check (length(id) between 3 and 400),
  tabela        text        not null check (length(tabela) between 1 and 40),
  -- base64 de iv (12 bytes) + texto cifrado (AES-GCM, com o id como dado associado).
  dados         text        not null default '',
  excluido_em   timestamptz,
  criado_em     timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (user_id, id)
);

create index if not exists idx_cofre_tabela on public.cofre (user_id, tabela, id);

alter table public.cofre enable row level security;
alter table public.cofre force row level security;

drop policy if exists dono_cofre on public.cofre;
create policy dono_cofre on public.cofre
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

revoke all on table public.cofre from anon;
grant select, insert, update, delete on public.cofre to authenticated;

drop trigger if exists tg_atualizacao on public.cofre;
create trigger tg_atualizacao before update on public.cofre
  for each row execute function public.marcar_atualizacao();

-- A chave mestra, embrulhada pela senha dos dados. Nulo = conta ainda sem cofre.
alter table public.perfis
  add column if not exists cofre jsonb;

-- O carimbo passa a olhar o cofre também: é por ele que um aparelho sabe
-- que outro mexeu.
create or replace function public.carimbo_da_conta()
returns timestamptz
language sql
stable
set search_path = public
as $$
  select max(em) from (
    select max(atualizado_em) as em from public.perfis
    union all select max(atualizado_em) from public.contas
    union all select max(atualizado_em) from public.lancamentos
    union all select max(atualizado_em) from public.ativos
    union all select max(atualizado_em) from public.ativo_historico
    union all select max(atualizado_em) from public.clientes
    union all select max(atualizado_em) from public.servicos
    union all select max(atualizado_em) from public.pagamentos
    union all select max(atualizado_em) from public.parcelas
    union all select max(atualizado_em) from public.metas
    union all select max(atualizado_em) from public.orcamentos
    union all select max(atualizado_em) from public.empreendedor_registros
    union all select max(atualizado_em) from public.cofre
  ) t;
$$;

revoke all on function public.carimbo_da_conta() from public;
grant execute on function public.carimbo_da_conta() to authenticated;

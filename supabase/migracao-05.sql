-- Categorias em dois andares.
--
-- A categoria continua onde estava e ganha uma subcategoria ao lado. Rode
-- este arquivo inteiro no SQL Editor do Supabase.
--
-- Enquanto ele não roda, o app continua funcionando e nada se perde: ele
-- percebe que a coluna não existe, manda o resto da sincronia e guarda a
-- subcategoria no aparelho até a coluna aparecer.

alter table public.lancamentos add column if not exists subcategoria text not null default '';

-- As subcategorias que a pessoa cria dentro de uma categoria.
create table if not exists public.subcategorias_extras (
  user_id       uuid        not null default auth.uid() references auth.users (id) on delete cascade,
  tipo          text        not null check (tipo in ('entrada', 'saida')),
  categoria     text        not null check (length(categoria) between 1 and 30),
  nome          text        not null check (length(nome) between 1 and 30),
  criado_em     timestamptz not null default now(),
  primary key (user_id, tipo, categoria, nome)
);

-- Mesma regra das outras tabelas: cada um só enxerga o que é seu.
alter table public.subcategorias_extras enable row level security;
alter table public.subcategorias_extras force row level security;
drop policy if exists dono_subcategorias_extras on public.subcategorias_extras;
create policy dono_subcategorias_extras on public.subcategorias_extras
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

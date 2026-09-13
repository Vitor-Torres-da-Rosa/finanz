-- ============================================================
-- Caixa — parte 3 de 3: seguranca, gatilhos e permissoes
--
-- Rode as tres partes NA ORDEM, uma de cada vez, no SQL Editor.
-- Cada uma pode ser rodada de novo sem quebrar nada.
-- ============================================================

-- ------------------------------------------------------------
-- Row Level Security
--
-- É aqui que mora o isolamento entre usuários. Sem estas linhas,
-- qualquer pessoa com a chave pública leria os dados de todo mundo.
-- ------------------------------------------------------------

do $$
declare
  t text;
  tabelas text[] := array[
    'contas', 'lancamentos', 'ativos', 'ativo_historico', 'metas',
    'orcamentos', 'categorias_extras', 'subcategorias_extras', 'clientes', 'servicos', 'pagamentos'
  ];
begin
  -- Perfil: a chave é a própria id do usuário.
  execute 'alter table public.perfis enable row level security';
  execute 'alter table public.perfis force row level security';
  execute 'drop policy if exists perfil_proprio on public.perfis';
  execute $p$
    create policy perfil_proprio on public.perfis
      for all to authenticated
      using (id = (select auth.uid()))
      with check (id = (select auth.uid()))
  $p$;

  -- Demais tabelas: a chave é user_id.
  foreach t in array tabelas loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force row level security', t);
    execute format('drop policy if exists %I on public.%I', 'dono_' || t, t);
    execute format($p$
      create policy %I on public.%I
        for all to authenticated
        using (user_id = (select auth.uid()))
        with check (user_id = (select auth.uid()))
    $p$, 'dono_' || t, t);
  end loop;
end;
$$;

-- ------------------------------------------------------------
-- Gatilhos de atualizado_em
-- ------------------------------------------------------------

do $$
declare
  t text;
  tabelas text[] := array[
    'perfis', 'contas', 'lancamentos', 'ativos', 'ativo_historico', 'metas',
    'orcamentos', 'clientes', 'servicos', 'pagamentos'
  ];
begin
  foreach t in array tabelas loop
    execute format('drop trigger if exists tg_atualizacao on public.%I', t);
    execute format(
      'create trigger tg_atualizacao before update on public.%I
         for each row execute function public.marcar_atualizacao()', t);
  end loop;
end;
$$;

-- Perfil criado junto com o usuário
drop trigger if exists ao_criar_usuario on auth.users;
create trigger ao_criar_usuario
  after insert on auth.users
  for each row execute function public.criar_perfil();

-- ------------------------------------------------------------
-- Permissões
--
-- anon é o papel de quem não fez login. Ele não precisa de nada
-- aqui: cadastro e login passam pelo serviço de autenticação,
-- não por estas tabelas.
-- ------------------------------------------------------------

revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Repare que não damos privilégio automático para tabelas futuras. Isso é
-- de propósito: combina com a opção "Automatically expose new tables"
-- desligada no projeto. Tabela nova só entra na API depois de um grant
-- explícito, feito de olho no que ela guarda.

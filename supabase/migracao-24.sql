-- Migração 24: dá para desligar a contagem de atividade
--
-- Rode este arquivo no SQL Editor de um projeto que já existe, ou deixe o
-- agendamento "Aplicar migrações no Supabase" rodar por você. Pode ser
-- rodado mais de uma vez sem quebrar nada.
--
-- Por quê (pedido do Vitor em 26/11/2026): a contagem de quem abriu o app
-- (migração 23) vem ligada, e a pessoa pode desligar em Preferências.
-- Desligada, a hora anotada é apagada e a conta não entra nos ativos —
-- nem pelo último login.
--
-- A escolha mora aqui no servidor, para valer em todos os aparelhos da
-- conta. O app manda:
--   nada        → só anota a hora, se a contagem estiver ligada;
--   p_contar    → true liga (e anota), false desliga (e apaga a hora).

alter table public.atividade alter column visto_em drop not null;
alter table public.atividade add column if not exists contar boolean not null default true;

drop function if exists public.marcar_atividade();

create or replace function public.marcar_atividade(p_contar boolean default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  ligada boolean;
begin
  if auth.uid() is null then
    return jsonb_build_object('staff', false, 'contar', true);
  end if;
  if p_contar is false then
    insert into public.atividade (user_id, visto_em, contar)
    values (auth.uid(), null, false)
    on conflict (user_id) do update set visto_em = null, contar = false;
  elsif p_contar is true then
    insert into public.atividade (user_id, visto_em, contar)
    values (auth.uid(), now(), true)
    on conflict (user_id) do update set visto_em = now(), contar = true;
  else
    insert into public.atividade (user_id, visto_em, contar)
    values (auth.uid(), now(), true)
    on conflict (user_id) do update
       set visto_em = excluded.visto_em
     where public.atividade.contar
       and (public.atividade.visto_em is null or public.atividade.visto_em < now() - interval '10 minutes');
  end if;
  select contar into ligada from public.atividade where user_id = auth.uid();
  return jsonb_build_object('staff', public.sou_staff(), 'contar', coalesce(ligada, true));
end;
$$;
revoke all on function public.marcar_atividade(boolean) from public;
grant execute on function public.marcar_atividade(boolean) to authenticated;

-- Quem desligou não entra nos ativos (nem pelo login) e aparece só como
-- um número: quantas contas pediram para não contar.
create or replace function public.staff_resumo()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, auth
as $$
declare
  r jsonb;
begin
  if not public.sou_staff() then
    raise exception 'só para a equipe do Finanz' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'cadastrados', count(*),
    'confirmados', count(*) filter (where u.email_confirmed_at is not null),
    'ativos_1',    count(*) filter (where coalesce(a.contar, true) and greatest(a.visto_em, u.last_sign_in_at) >= now() - interval '1 day'),
    'ativos_7',    count(*) filter (where coalesce(a.contar, true) and greatest(a.visto_em, u.last_sign_in_at) >= now() - interval '7 days'),
    'ativos_30',   count(*) filter (where coalesce(a.contar, true) and greatest(a.visto_em, u.last_sign_in_at) >= now() - interval '30 days'),
    'sem_contar',  count(*) filter (where a.contar = false),
    'novos_7',     count(*) filter (where u.created_at >= now() - interval '7 days'),
    'novos_30',    count(*) filter (where u.created_at >= now() - interval '30 days'),
    'com_senha',   (select count(*) from public.perfis p where p.cofre is not null),
    'agora',       now()
  ) into r
    from auth.users u
    left join public.atividade a on a.user_id = u.id
   where u.deleted_at is null;
  return r;
end;
$$;
revoke all on function public.staff_resumo() from public;
grant execute on function public.staff_resumo() to authenticated;

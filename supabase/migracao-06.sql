-- Limite do cartão de crédito.
--
-- Rode este arquivo no SQL Editor do Supabase. Enquanto ele não roda, o app
-- continua funcionando e nada se perde: ele percebe que a coluna não existe,
-- manda o resto da sincronia e guarda o limite no aparelho até a coluna
-- aparecer.

alter table public.contas add column if not exists limite bigint not null default 0;

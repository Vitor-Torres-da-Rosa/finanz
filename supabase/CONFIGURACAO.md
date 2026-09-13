# Ligando o Finanz ao Supabase

Guia de configuração, na ordem. São uns 20 minutos.
No fim você me manda duas chaves e eu escrevo a sincronização.

---

## 1. Criar o projeto

1. Entre em <https://supabase.com> e crie a conta (dá para entrar com o GitHub).
2. **New project**.
   - **Name**: `caixa`
   - **Database Password**: gere uma senha forte e **guarde**. Ela não aparece de novo e é o acesso direto ao banco.
   - **Region**: `South America (São Paulo)` — mais rápido para quem usa daqui, e mantém os dados no Brasil, o que simplifica a LGPD.
3. Espere uns 2 minutos até o projeto ficar verde.

---

## 2. Criar as tabelas e ligar a segurança

1. No menu da esquerda, **SQL Editor** → **New query**.
2. Abra o arquivo `supabase/schema.sql` deste repositório, copie **tudo** e cole lá.
3. Clique em **Run**.

Vai aparecer um punhado de mensagens `NOTICE: ... does not exist, skipping`. **É normal** — o arquivo foi escrito para poder ser rodado de novo sem quebrar, então ele tenta apagar coisas que ainda não existem na primeira vez.

### Projeto que já estava de pé

O `schema.sql` é a foto de agora e pode ser rodado de novo por cima sem
estragar nada. Se preferir aplicar só o que mudou, os arquivos
`migracao-01.sql` … `migracao-05.sql` trazem cada leva em separado, na
ordem do número. Rode os que ainda não rodou.

A `migracao-05.sql` é a das categorias em dois andares: acrescenta a coluna
`subcategoria` em `lancamentos` e cria a tabela `subcategorias_extras`.
Enquanto ela não roda, o app continua funcionando e nada se perde — ele
percebe que a coluna não existe, manda o resto e guarda a subcategoria no
aparelho até a coluna aparecer.

### Conferindo se a segurança ficou de pé

Rode esta consulta numa aba nova do SQL Editor:

```sql
select tablename,
       rowsecurity as rls_ligada,
       (select count(*) from pg_policies p where p.tablename = t.tablename) as politicas
  from pg_tables t
 where schemaname = 'public'
 order by tablename;
```

Você precisa ver **11 linhas**, todas com `rls_ligada = true` e `politicas = 1`:

```
ativo_historico, ativos, categorias_extras, clientes, contas,
lancamentos, metas, orcamentos, pagamentos, perfis, servicos
```

Se alguma linha vier com `rls_ligada = false`, **pare e me avise**. Uma tabela sem RLS fica legível por qualquer pessoa que tenha a chave pública — que é justamente o erro mais comum de quem usa Supabase.

---

## 3. Endereços do aplicativo

**Authentication** → **URL Configuration**:

- **Site URL**: `https://vitor-torres-da-rosa.github.io/finanz/`
- **Redirect URLs**: adicione as duas linhas
  - `https://vitor-torres-da-rosa.github.io/finanz/`
  - `http://localhost:8811/` *(para eu conseguir testar aqui)*

Sem isso o login com Google volta com erro de redirecionamento.

---

## 4. Login com Google

Esta parte é no Google, não no Supabase. Antes de começar, copie a **callback** do Supabase: em **Authentication** → **Providers** → **Google**, tem uma linha escrita `Callback URL (for OAuth)`. É algo como `https://abcdefgh.supabase.co/auth/v1/callback`. Guarde.

Agora, em <https://console.cloud.google.com>:

1. Crie um projeto (nome livre, pode ser `Finanz`).
2. **APIs e serviços** → **Tela de permissão OAuth**:
   - Tipo: **Externo**
   - Nome do app: `Finanz`
   - E-mail de suporte e e-mail do desenvolvedor: o seu
   - Salve e siga até o fim. Pode deixar em modo **Teste** por enquanto; nesse modo só os e-mails que você cadastrar como testadores conseguem entrar. Para abrir ao público é preciso publicar o app.
3. **APIs e serviços** → **Credenciais** → **Criar credenciais** → **ID do cliente OAuth**:
   - Tipo: **Aplicativo da Web**
   - **Origens JavaScript autorizadas**: `https://vitor-torres-da-rosa.github.io`
   - **URIs de redirecionamento autorizados**: cole a *callback* do Supabase que você guardou
4. Copie o **ID do cliente** e a **Chave secreta do cliente**.
5. Volte ao Supabase → **Authentication** → **Providers** → **Google** → ligue, cole os dois valores, **Save**.

---

## 5. Confirmação de e-mail

**Authentication** → **Sign In / Providers** → **Email**.

Você escolhe:

- **Confirm email ligado** (recomendado depois): a pessoa só entra após clicar no link do e-mail. Impede cadastro com e-mail de terceiros.
- **Confirm email desligado** (mais prático agora, no teste): entra na hora.

Aviso importante: o servidor de e-mail que vem junto do Supabase é só para desenvolvimento e tem limite baixo de mensagens por hora. Para valer, você vai precisar plugar um SMTP próprio (Resend, Brevo, SendGrid) em **Project Settings** → **Authentication** → **SMTP Settings**.

---

## 6. As duas chaves que eu preciso

**Project Settings** → **API**:

| O que | Onde está | Pode mandar? |
|---|---|---|
| **Project URL** | `https://xxxx.supabase.co` | Sim |
| **anon public** | chave longa começando em `eyJ...` | Sim |
| `service_role` | logo abaixo, marcada como secreta | **Nunca** |
| Senha do banco | a do passo 1 | **Nunca** |

As duas primeiras são públicas por natureza — elas ficam dentro do aplicativo, qualquer pessoa consegue ver no navegador. A segurança não vem de escondê-las, vem do RLS que você acabou de configurar. Já a `service_role` **ignora todo o RLS**: quem tiver ela lê e apaga os dados de todos os usuários.

Me mande as duas primeiras aqui no chat e eu escrevo a sincronização.

---

## 7. Coisas para saber antes de abrir para outras pessoas

- **O plano grátis pausa o projeto** depois de alguns dias sem acesso. Basta reativar no painel, mas para cliente de verdade isso não serve — precisa do plano pago.
- **Backup**: o plano grátis não tem backup automático. No pago tem backup diário. Enquanto isso, o botão "Fazer backup" dentro do app continua valendo.
- **Nunca desligue o RLS** de uma tabela para "resolver um problema". Se algo não estiver aparecendo, o certo é ajustar a política, não desligar a proteção.
- **Ao criar tabela nova**, ligue RLS nela na mesma hora. Tabela nova nasce desprotegida.

---

## Como testei este schema

Não subi nada no seu projeto. Rodei o `schema.sql` num Postgres 16 local, com uma imitação do `auth.uid()` do Supabase, e conferi:

| Teste | Resultado |
|---|---|
| Perfil criado sozinho ao cadastrar usuário | passou |
| `user_id` preenchido sozinho com o dono certo | passou |
| Usuário B enxergar dados do A | 0 linhas em todas as tabelas |
| B alterar lançamento do A | `UPDATE 0` |
| B apagar conta do A | `DELETE 0` |
| B inserir linha no nome do A | recusado pela política |
| Visitante sem login lendo qualquer tabela | permissão negada |
| Transferência para a mesma conta | recusada pela restrição |
| Lançamento com valor negativo | recusado pela restrição |
| `atualizado_em` subindo sozinho | passou |
| RLS ligada nas 11 tabelas | passou |
| `anon` com algum privilégio | nenhum |

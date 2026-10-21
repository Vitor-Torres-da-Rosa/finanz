# Testes do Finanz

São 70 testes que abrem o app num navegador de verdade, clicam nas telas
como uma pessoa clicaria e conferem o que aparece. Não é teste de pedacinho
de código isolado: é o app inteiro rodando, com servidor, banco de dados e
login funcionando.

Rodando os 70 em paralelo, leva uns cinco minutos.

---

## Como rodar

Uma vez por container (instala o Postgres, cria o banco, baixa o módulo `pg`):

```
testes/preparar.sh
```

Depois, quantas vezes quiser:

```
node testes/rodar.mjs                  # todos, 8 ao mesmo tempo
node testes/rodar.mjs 4                # todos, 4 ao mesmo tempo
node testes/rodar.mjs 12 t72 t80 t81   # só esses três
```

Mexeu no `index.html`? Não precisa fazer nada: o `rodar.mjs` chama o
`subir.sh`, que recopia o app para `appteste/` antes de cada rodada. (Antes
só o `preparar.sh` copiava, e esquecer dele fazia a suíte inteira passar
testando o arquivo de antes da mudança — verde por motivo nenhum.)

Rodando um caso direto (`node testes/casos/t106.mjs`), a cópia **não** se
refaz. Para isso:

```
cp index.html sw.js manifest.webmanifest testes/appteste/
```

---

## As peças

```
testes/
  preparar.sh     deixa o container pronto (uma vez por sessão)
  subir.sh        levanta Postgres, emulador e servidor (idempotente)
  rodar.mjs       roda os testes em paralelo e resume o resultado
  comum.mjs       de onde cada teste tira o Playwright e as pastas
  emulador.mjs    finge ser o Supabase: login, tabelas, RLS
  servir.cjs      servidor de arquivos do app, na porta 8833
  stub-auth.sql   imita o schema `auth` do Supabase no Postgres local
  config-teste.js o config.js que aponta o app para o emulador
  casos/          os 70 testes
  amostras/       PDFs, planilhas e CSVs de exemplo
  leitor/         fonte modular do leitor de extrato (veja no fim)
  appteste/       cópia do app servida nos testes (não vai para o git)
  saidas/         imagens de tela e arquivos gerados (não vão para o git)
```

**O emulador** (`emulador.mjs`) é um servidor Node de umas 300 linhas que
responde no mesmo formato do Supabase: `/auth/v1/signup`, `/auth/v1/token`,
`/rest/v1/<tabela>`. Por baixo ele fala com um Postgres 16 de verdade, na
porta 55433, com o **mesmo schema e as mesmas regras de RLS** que estão em
`supabase/`. Isso importa: um teste que passa aqui provou que as políticas
de segurança deixam o app trabalhar, não só que a tela desenhou bonito.

**O servidor** (`servir.cjs`) serve `appteste/`, que é uma cópia do app com
um `config.js` apontando para o emulador em vez do Supabase de verdade.
Nenhum teste encosta na sua conta ou nos seus dados.

---

## Como um teste é por dentro

```js
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';

const browser = await chromium.launch();
const page = await (await browser.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2
})).newPage();

await page.goto(ENDERECO, { waitUntil: 'networkidle' });
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' });

// cria uma conta nova
await page.click('.btn-dourado:has-text("Criar minha conta")');
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t99' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
// ...

// e então confere
console.log('1. o total ficou:', await page.textContent('#folha .valorao'));

await browser.close();
```

A tela é de celular (390×844) porque é assim que o app é usado.

**Como o teste diz que falhou:** ele não tem `assert`. Se um clique não
acha o que devia, o Playwright estoura sozinho, o processo morre com erro e
o `rodar.mjs` marca `X`. Os `console.log` são para eu ler o que aconteceu —
eles aparecem só quando o teste falha.

**Por que cada teste cria a própria conta:** é o que deixa rodar em
paralelo sem um pisar no outro. Duas contas diferentes são dois `user_id`
diferentes, e o RLS separa os dados. O `process.pid` no e-mail garante que
dois testes que nasçam no mesmo milissegundo não peçam a mesma conta.

---

## Escrevendo um teste novo

1. Copie o `casos/t80.mjs`, que é dos mais completos.
2. Numere o próximo (`t82.mjs`) e troque o prefixo do e-mail.
3. Escreva no começo, em comentário, **o que ele prova** — não o que ele faz.
4. Rode só ele: `node testes/rodar.mjs 1 t82`.
5. Rode tudo antes de subir: `node testes/rodar.mjs`.

Um teste bom prova uma coisa que quebraria de verdade. Os que valeram mais
até hoje foram os que travaram um bug já consertado, para ele não voltar:
o saldo do extrato lido na coluna errada (t76), a descrição repetida (t74),
a tela que pulava ao trocar de página (t67).

---

## O que estes testes não cobrem

- **O Supabase de verdade.** O emulador imita o formato e o RLS, mas não é
  o mesmo programa. Coisa de configuração do painel — e-mail, login com
  Google, URLs de redirecionamento — só se descobre lá.
- **O celular de verdade.** É Chromium num container. Compartilhar arquivo,
  instalar o app, abrir o Maps ou o Waze — isso é do Android, e só o
  aparelho mostra.
- **Se está bonito.** O teste confere texto e número. Rótulo cortado na
  borda, cor errada, espaçamento apertado: isso só vendo a imagem de tela,
  que fica em `saidas/`.

---

## `leitor/` — o fonte do leitor de extrato

O leitor de PDF, XLSX, OFX e CSV mora **dentro** do `index.html`, porque o
app é um arquivo só. Mas escrever duas mil linhas dentro de um HTML é ruim,
então o fonte fica separado aqui, em pedaços:

```
leitor/leitor.js    MD5, RC4, AES — PDF com senha
leitor/parser.js    objetos do PDF, Flate, LZW, ASCII85, previsores
leitor/doc.js       o documento e a decifragem
leitor/texto.js     fontes, CMaps e a montagem das linhas de texto
leitor/xlsx.js      ZIP e planilha
leitor/extrato.js   achar data, valor, banco e categoria em cada linha
leitor/montar.py    junta tudo num bloco só
```

Para mexer no leitor:

```
cd testes/leitor && python3 montar.py     # gera bloco.js
```

e troque, no `index.html`, o trecho que vai de `var Extrato = (function ()`
até o `})();` logo depois do `return { lerPdf, ... }`.

Dá para provar o leitor sem abrir navegador nenhum, o que é bem mais rápido:

```js
import fs from 'fs';
const E = new Function(fs.readFileSync('bloco.js','utf8') + '\nreturn Extrato;')();
const r = await E.lerPdf(new Uint8Array(fs.readFileSync('../amostras/inter.pdf')), '');
console.log(E.lerLinhas(r.linhas, 'inter.pdf').itens);
```

// Banco sem a migração nova não pode derrubar a sincronização inteira.
//
// A 5.24.0 passou a mandar lancamentos.data_destino, que só existe depois
// da migração 10. Entre atualizar o app e a migração rodar há uma janela —
// e nessa janela o servidor responde "não achei essa coluna" para TODO
// envio de lançamentos. Sem tratamento, ninguém sincroniza nada.
//
// O app já sabia lidar com isso para `subcategoria`: tentar de novo sem a
// coluna e seguir. Este teste garante que `data_destino` entrou na mesma
// lista — porque esquecer de registrar uma coluna nova ali não dá erro
// nenhum em teste, só em produção, no pior momento.
//
// O banco de teste já tem a coluna, então quem recusa aqui é a rede: o
// primeiro POST com data_destino volta PGRST204, como um Supabase
// desatualizado responderia. Sem tocar no banco, que é compartilhado
// pelos outros noventa testes rodando ao lado.
import { chromium, dir, ENDERECO } from '../comum.mjs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const porDinheiro = async (loc, d) => {
  await loc.click();
  for (let i = 0; i < 16; i++) await loc.press('Backspace');
  await loc.type(d);
  await page.waitForTimeout(300);
};
const semDialogo = async () => {
  if (!(await page.locator('#dialogoFundo.aberta').count())) return '';
  const t = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
  const bs = page.locator('#dialogoAcoes button');
  await bs.nth((await bs.count()) - 1).click();
  await page.waitForTimeout(900);
  return t;
};
const irParaInicio = async () => {
  for (let i = 0; i < 8; i++) {
    if (await page.locator('#telaInicio:visible').count()) return;
    await page.locator('#navegacao button').nth(1).click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    await page.locator('#navegacao button').nth(0).click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }
};

// O servidor que ainda não rodou a migração 10.
let recusas = 0, passaram = 0;
await page.route('**/rest/v1/lancamentos*', async (rota) => {
  const pedido = rota.request();
  const corpo = pedido.method() === 'POST' ? (pedido.postData() || '') : '';
  if (corpo.indexOf('data_destino') >= 0) {
    recusas++;
    await rota.fulfill({
      status: 400,
      contentType: 'application/json',
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        code: 'PGRST204',
        message: "Could not find the 'data_destino' column of 'lancamentos' in the schema cache"
      })
    });
    return;
  }
  if (pedido.method() === 'POST') passaram++;
  await rota.continue();
});

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t133-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await irParaInicio();
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1300);
await page.click('#fab'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '32000');
await folha().locator('input.entrada[type=text]').first().fill('Aluguel');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1600);

await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Sincronizar agora")'); await page.waitForTimeout(9000);
await semDialogo();

console.log('envios recusados por falta da coluna:', recusas, '· envios que passaram:', passaram);
conferir('1. o servidor recusou pelo menos um envio por falta da coluna',
  recusas >= 1, recusas + ' recusa(s)');
conferir('2. e o app tentou de novo sem ela', passaram >= 1, passaram + ' envio(s) aceito(s)');

// O que importa: o lançamento chegou lá.
const noServidor = await page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/lancamentos?select=id,valor&excluido_em=is.null',
    { headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
  return await r.json();
});
conferir('3. o lançamento chegou no servidor mesmo assim',
  Array.isArray(noServidor) && noServidor.length === 1 && noServidor[0].valor === 32000,
  JSON.stringify(noServidor));

// E a tela não pode estar acusando falha de sincronização.
const noMais = limpo(await page.textContent('#telaMais').catch(() => ''));
conferir('4. e a tela não acusa falha de sincronização',
  !/tentativa\(s\) sem sucesso/.test(noMais),
  (noMais.match(/\d+ tentativa\(s\)[^.]*/) || ['sem recado de falha'])[0]);
await page.screenshot({ path: dir+'/w04-sem-a-coluna.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: banco sem a migração 10 não derruba a sincronização');

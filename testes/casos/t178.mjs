// Extrato do Itaú no modelo "Extrato conta corrente" (pedido do Vitor em
// 19/11/2026): as linhas só com data e saldo são o saldo do dia, não
// lançamento — viravam "Entrada" de R$ 4.000/5.000. A regra vale só para
// o Itaú: mexer num banco não mexe nos outros.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.clock.setFixedTime(new Date(2026, 10, 19, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t178-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

page.on('filechooser', async fc => { await fc.setFiles(amostras + '/itau-visualizacao.pdf'); });
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
await page.click('#telaMais .linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .item-extrato', { timeout: 60000 }); await page.waitForTimeout(800);
const itens = await page.$$eval('#folha .item-extrato', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
console.log(itens.join('\n'));
conferir('1. só os 9 lançamentos; o saldo do dia não vira "Entrada"', itens.length === 9 && !itens.some(t => /^✓?\s*Entrada\b/.test(t)), itens.length + ' itens');
const tela = limpo(await page.textContent('#folha'));
conferir('2. a soma bate com o extrato: entradas R$ 2.848,97 e saídas R$ 966,89', /Entradas R\$ 2\.848,97/.test(tela) && /Saídas R\$ 966,89/.test(tela),
  (tela.match(/Entradas R\$ [\d.,]+ ?Saídas R\$ [\d.,]+/) || [''])[0]);
conferir('3. reconhece o Itaú', /Itaú/.test(tela));
await page.screenshot({ path: dir + '/z106-itau-sem-saldo-do-dia.png' });
console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

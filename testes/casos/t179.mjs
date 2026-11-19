// Extrato do Bradesco em PDF e em CSV (pedido do Vitor em 19/11/2026):
// colunas Crédito, Débito e Saldo. Antes só entravam as receitas (o saldo
// era lido como valor, e no débito o saldo 0,00 zerava o lançamento).
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t179-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

const ler = async (arquivo) => {
  page.removeAllListeners('filechooser');
  page.on('filechooser', async fc => { await fc.setFiles(amostras + '/' + arquivo); });
  for (let i = 0; i < 4 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(500); }
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
  await page.click('#telaMais .linha:has-text("Importar extrato")');
  await page.waitForSelector('#folha .item-extrato', { timeout: 60000 }); await page.waitForTimeout(800);
  const itens = await page.$$eval('#folha .item-extrato', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
  return { itens, tela: limpo(await page.textContent('#folha')) };
};

for (const arq of ['bradesco-extrato.pdf', 'bradesco-extrato.csv']) {
  const r = await ler(arq);
  console.log('== ' + arq + '\n' + r.itens.join('\n'));
  conferir(arq + ': os 9 lançamentos, créditos e débitos', r.itens.length === 9 &&
    r.itens.filter(t => /\+ R\$/.test(t)).length === 4 && r.itens.filter(t => /− R\$/.test(t)).length === 5, r.itens.length + ' itens');
  conferir(arq + ': entradas e saídas de R$ 4.983,34, com o valor da coluna e não o saldo',
    /Entradas R\$ 4\.983,34/.test(r.tela) && /Saídas R\$ 4\.983,34/.test(r.tela) && r.itens.some(t => /PIX ENVIADO.*− R\$ 30,00/.test(t)),
    (r.tela.match(/Entradas R\$ [\d.,]+ ?Saídas R\$ [\d.,]+/) || [''])[0]);
  conferir(arq + ': a descrição é o histórico, não o número do documento',
    r.itens.every(t => /TRANSF SALDO C\/SAL P\/CC|PIX ENVIADO/.test(t)) && !r.itens.some(t => /^✓?\s*\d{7}/.test(t)));
  if (arq.endsWith('.pdf')) await page.screenshot({ path: dir + '/z107-bradesco-pdf.png' });
}
console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

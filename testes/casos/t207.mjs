// Extrato do Inter em CSV (pedido do Vitor em 28/11/2026): "Data
// Lançamento;Histórico;Descrição;Valor;Saldo". O app lia o Saldo como
// valor e só o nome como descrição. Agora: o valor com sinal, a descrição
// como no PDF ("Pix enviado: Fulano"), em ordem de data, e importar de
// novo reconhece tudo como "já existe".
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t207-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await page.locator('#folha input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);

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


const r = await ler('inter-extrato.csv');
console.log(r.itens.join('\n'));
conferir('1. os 5 lançamentos, com o valor da coluna Valor e não o saldo',
  r.itens.length === 5 && /Entradas R\$ 442,00/.test(r.tela) && /Saídas R\$ 282,62/.test(r.tela) &&
  r.itens.some(t => /Joana Exemplo.*− R\$ 10,90/.test(t)) && !r.itens.some(t => /73,54|84,44|116,08|325,92|250,88/.test(t)),
  (r.tela.match(/Entradas R\$ [\d.,]+ ?Saídas R\$ [\d.,]+/) || [''])[0]);
conferir('2. a descrição junta o histórico e o nome, como no PDF',
  r.itens.some(t => /Pix enviado: Posto Exemplo/i.test(t)) && r.itens.some(t => /Pix recebido: Fulano De Tal/i.test(t)) && r.itens.filter(t => /Pix (enviado|recebido):/i.test(t)).length === 5);
conferir('3. em ordem de data, do mais velho para o mais novo', /De 17\/11\/2026 a 24\/11\/2026/.test(r.tela) && /17\/11\/2026/.test(r.itens[0]) && /24\/11\/2026/.test(r.itens[4]));
await page.screenshot({ path: dir + '/z207-inter-csv.png' });
await page.locator('#folha .btn-ouro:has-text("Importar")').first().click();
await page.waitForSelector('#dialogoFundo.aberta', { timeout: 30000 }).catch(() => {});
await page.click('#dialogoAcoes button').catch(() => {}); await page.waitForTimeout(1500);
const r2 = await ler('inter-extrato.csv');
conferir('4. importando de novo, os 5 vêm como "já existe"', r2.itens.filter(t => /já existe/.test(t)).length === 5, r2.itens.filter(t => /já existe/.test(t)).length);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

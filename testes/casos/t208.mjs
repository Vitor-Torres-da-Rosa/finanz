// Extrato do C6 em planilha (pedido do Vitor em 28/11/2026): o .xlsx vem
// trancado com senha (cifra do Office). O app pede a senha, abre no
// aparelho e lê pelas colunas Entrada e Saída (não o saldo do dia).
// As amostras são inventadas (gerar-c6-planilha-senha.py, senha 123456):
// uma com a cifra "padrão" (a do C6) e outra com a "ágil" (Excel de hoje).
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t208-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await page.locator('#folha input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);

const abrir = async (arquivo) => {
  page.removeAllListeners('filechooser');
  page.on('filechooser', async fc => { await fc.setFiles(amostras + '/' + arquivo); });
  for (let i = 0; i < 4 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(500); }
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
  await page.click('#telaMais .linha:has-text("Importar extrato")');
  await page.waitForFunction(() => /Planilha com senha/.test((document.querySelector('#folhaTitulo') || {}).textContent || ''), null, { timeout: 30000 }).catch(() => {});
};
const digitar = async (senha) => {
  await page.fill('#folha input[type=password]', senha);
  await page.click('#folha .btn-ouro:has-text("Abrir")');
};
const itensNaTela = async () => {
  await page.waitForSelector('#folha .item-extrato', { timeout: 60000 }); await page.waitForTimeout(800);
  return { itens: await page.$$eval('#folha .item-extrato', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim())), tela: limpo(await page.textContent('#folha')) };
};

await abrir('c6-extrato-senha.xlsx');
conferir('1. a planilha trancada pede a senha', /Planilha com senha/.test(await page.textContent('#folhaTitulo').catch(() => '')));
await page.screenshot({ path: dir + '/z208-senha.png' });
await digitar('000000');
await page.waitForFunction(() => /Essa senha não abriu/.test((document.querySelector('#folha') || {}).textContent || ''), null, { timeout: 60000 }).catch(() => {});
conferir('2. senha errada: pede de novo, explicando', /Essa senha não abriu/.test(limpo(await page.textContent('#folha'))));
await digitar('123456');
let r = await itensNaTela();
console.log(r.itens.join('\n'));
conferir('3. com a senha certa, os 4 lançamentos pelas colunas Entrada e Saída (não o saldo do dia)',
  r.itens.length === 4 && /Entradas R\$ 750,00/.test(r.tela) && /Saídas R\$ 210,40/.test(r.tela) && !r.itens.some(t => /1\.500,00|1\.379,50|1\.289,60|1\.539,60/.test(t)),
  (r.tela.match(/Entradas R\$ [\d.,]+ ?Saídas R\$ [\d.,]+/) || [''])[0]);
conferir('4. a descrição junta o título e o nome', r.itens.some(t => /Pix recebido: Cliente Exemplo/i.test(t)) && r.itens.some(t => /Pagamento de boleto: Energia Exemplo/i.test(t)));
await page.screenshot({ path: dir + '/z208-c6-planilha.png' });

await abrir('c6-extrato-senha-agil.xlsx');
await digitar('123456');
r = await itensNaTela();
conferir('5. a cifra ágil (Excel de hoje) também abre', r.itens.length === 4 && /Entradas R\$ 750,00/.test(r.tela) && /Saídas R\$ 210,40/.test(r.tela));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

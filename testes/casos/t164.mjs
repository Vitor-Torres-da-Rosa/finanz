// Contas de casa › Mercado: foto da nota, item por item (pedido do Vitor
// em 09/11/2026).
//
// A foto passa pelo leitor (Tesseract, servido junto com o app em leitor/),
// o app separa nome e valor de cada item e mostra para conferir: dá para
// corrigir, apagar e acrescentar. A compra se divide entre quem mora junto.
// Não entra nas despesas.
import { chromium, dir, ENDERECO } from '../comum.mjs';
import path from 'path';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const dinheiro = async (loc, digitos) => {
  await loc.click(); for (let i = 0; i < 14; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(200);
};

// A foto da nota: uma nota de mercado comum, levemente torta.
const foto = path.join(dir, 'nota-mercado.jpg');
{
  const p = await browser.newPage({ viewport: { width: 560, height: 760 }, deviceScaleFactor: 1.5 });
  await p.goto('file://' + path.join(path.dirname(dir), 'amostras', 'nota-mercado.html'));
  await p.screenshot({ path: foto, type: 'jpeg', quality: 70 });
  await p.close();
}

await page.clock.setFixedTime(new Date(2026, 10, 9, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t164-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Ana divide com 40%.
await page.click('#telaInicio .cartao-casa button:has-text("+ Contas de casa")'); await page.waitForTimeout(900);
await page.click('#folha .cartao-acao:has-text("+ Pessoa")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome').fill('Ana');
await folha().getByLabel('Quanto entra nas contas (%)').fill('40');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(900);

await page.click('#folha .abas-casa button:has-text("Mercado")'); await page.waitForTimeout(700);
const fm = limpo(await folha().textContent());
conferir('1. Contas de casa tem a aba Mercado, com a foto da nota', /Mercado em novembro\s*R\$ 0,00/.test(fm) &&
  await folha().locator('button:has-text("Foto da nota")').count() === 1, fm.slice(0, 200));

const [escolha] = await Promise.all([page.waitForEvent('filechooser'), page.click('#folha button:has-text("Foto da nota")')]);
await escolha.setFiles(foto);
await page.waitForTimeout(500);
conferir('2. mostra que está lendo', /Lendo/.test(await page.textContent('#folhaTitulo').catch(() => '')));
await page.waitForFunction(() => /Confira a nota/.test(document.getElementById('folhaTitulo')?.textContent || ''), null, { timeout: 90000 });
await page.waitForTimeout(500);

const itens = await page.$$eval('#folha .item-nota', ns => ns.map(n => {
  const [a, b] = n.querySelectorAll('input');
  return a.value + ' = ' + b.value.replace(/ /g, ' ');
}));
console.log('lidos:', itens.join(' | '));
const esperado = ['Arroz Tio Joao 5kg = R$ 25,90', 'Feijao Preto 1kg = R$ 16,98', 'Leite Integral 1l = R$ 28,74',
  'Banana Prata = R$ 8,63', 'Coca Cola 2l = R$ 10,99', 'Acucar Uniao 1kg = R$ 5,49'];
conferir('3. leu os 6 itens, cada um com nome e valor', itens.length === 6 && esperado.every((e, i) => itens[i] === e), itens.join(' | '));
const r1 = limpo(await folha().locator('.total-calculado').textContent());
conferir('4. o desconto e o total da nota batem', /Soma dos itens\s*R\$ 96,73/.test(r1) && /Desconto\s*− R\$ 2,00/.test(r1) &&
  /Total da compra\s*R\$ 94,73/.test(r1) && /Total na nota\s*R\$ 94,73 ✓/.test(r1), r1);
conferir('5. o local veio da nota', /Supermercado Bom Preco Ltda/.test(await folha().getByLabel('Onde').inputValue()));
await page.screenshot({ path: dir + '/z70-confira-a-nota.png', fullPage: true });

// Corrigir: a coca era 9,99; apagar o açúcar; acrescentar sacola de 0,50.
// 96,73 − 1,00 − 5,49 + 0,50 = 90,74; menos 2,00 de desconto = 88,74.
await dinheiro(folha().getByLabel('Valor do item 5'), '999');
await page.click('#folha [aria-label="Apagar o item 6"]'); await page.waitForTimeout(300);
await page.click('#folha button:has-text("+ Item")'); await page.waitForTimeout(300);
await folha().getByLabel('Item 6', { exact: true }).fill('Sacola');
await dinheiro(folha().getByLabel('Valor do item 6'), '50');
await folha().getByLabel('Parte de Ana (%)').fill('50');
await page.waitForTimeout(300);
const r2 = limpo(await folha().locator('.total-calculado').textContent());
conferir('6. corrigindo, a conta acompanha e avisa a diferença para a nota',
  /Soma dos itens\s*R\$ 90,74/.test(r2) && /Total da compra\s*R\$ 88,74/.test(r2) && /Total na nota\s*R\$ 94,73 \(falta R\$ 5,99\)/.test(r2) &&
  /Você paga\s*R\$ 44,38/.test(r2) && /Ana paga\s*R\$ 44,36/.test(r2), r2);
await page.click('#folha .btn-ouro:has-text("Salvar compra")'); await page.waitForTimeout(1000);

const f2 = limpo(await folha().textContent());
conferir('7. a compra entra no Mercado do mês com a sua parte', /Mercado em novembro\s*R\$ 88,74/.test(f2) && /Sua parte: R\$ 44,38/.test(f2) &&
  /Supermercado Bom Preco Ltda\s*09\/11\/2026 · 6 item\(ns\) · por Vitor\s*R\$ 88,74\s*sua parte R\$ 44,38/.test(f2), f2.slice(0, 400));
await page.screenshot({ path: dir + '/z71-mercado.png' });

// Abrindo de novo, os itens corrigidos estão lá.
await page.click('#folha .linha:has-text("Supermercado Bom Preco")'); await page.waitForTimeout(900);
const nomes = await page.$$eval('#folha .item-nota input:first-child', ns => ns.map(n => n.value));
conferir('8. abrindo a compra, os itens corrigidos', nomes.length === 6 && nomes[5] === 'Sacola' && !nomes.includes('Acucar Uniao 1kg'), nomes.join(', '));
for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }

const cc = limpo(await page.locator('#telaInicio .cartao-casa').textContent());
conferir('9. o cartão da Visão geral mostra o mercado do mês', /Mercado em novembro: R\$ 88,74 · sua parte R\$ 44,38/.test(cc), cc);
const desp = limpo(await page.locator('#telaInicio .kpi:has-text("Despesas")').first().textContent());
conferir('10. e as despesas não mudam', /R\$ 0,00/.test(desp), desp);

// Sem foto também dá.
await page.click('#telaInicio .cartao-casa .cartao-acao:has-text("Abrir")'); await page.waitForTimeout(900);
await page.click('#folha button:has-text("+ Compra sem foto")'); await page.waitForTimeout(800);
await folha().getByLabel('Item 1', { exact: true }).fill('Pão');
await dinheiro(folha().getByLabel('Valor do item 1'), '1200');
await page.click('#folha .btn-ouro:has-text("Salvar compra")'); await page.waitForTimeout(900);
conferir('11. compra sem foto, lançada à mão', /Mercado em novembro\s*R\$ 100,74/.test(limpo(await folha().textContent())));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

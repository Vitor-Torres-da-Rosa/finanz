// Taxas da maquininha por bandeira e por parcela, e o PDF com a tabela
// inteira de parcelamentos para o cliente escolher.
import { chromium, dir, ENDERECO } from '../comum.mjs';
import { irParaClientes } from '../comum.mjs';
import fs from 'node:fs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, acceptDownloads:true });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t82' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// --- as taxas, coladas do app da maquininha ---
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Taxas da maquininha")'); await page.waitForTimeout(1000);
console.log('1. bandeiras de fábrica:', await page.$$eval('#folha .cartao-titulo', ns=>ns.map(n=>n.textContent)));
await page.click('#folha .btn-fantasma:has-text("Colar a tabela")'); await page.waitForTimeout(900);
await page.locator('#folha textarea').fill(
  'Débito 1,37%\n1x 3,15%\n2x 5,39%\n3x 6,12%\n4x 6,85%\n5x 7,57%\n6x 8,28%\n' +
  '7x 8,99%\n8x 9,69%\n9x 10,38%\n10x 11,06%\n11x 11,74%\n12x 12,40%');
console.log('2. achou:', await page.textContent('#folha .linha-nota'));
await page.click('#folha .btn-ouro:has-text("Usar estas taxas")'); await page.waitForTimeout(1200);
const taxas = await page.$$eval('#folha .grade-taxas .entrada', ns=>ns.slice(0,12).map(n=>n.value));
console.log('3. taxas na primeira bandeira:', taxas.join(' '));
console.log('4. débito:', await page.locator('#folha .campo:has-text("Débito") input').first().inputValue());
await page.screenshot({ path: dir+'/p01-taxas.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar as taxas")'); await page.waitForTimeout(1500);

// --- um orçamento usando essas taxas ---
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
await irParaClientes(page); await page.waitForTimeout(1200);
await page.click('#telaInicio .fab, #telaInicio button:has-text("Cadastrar primeiro cliente")'); await page.waitForTimeout(1000);
await page.locator('#folha input.entrada').nth(0).fill('Daniela Torres');
await page.locator('#folha input[type=tel]').first().fill('51985010000');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
await page.click('#telaInicio .linha-alvo:has-text("Daniela Torres")'); await page.waitForTimeout(1400);
await page.click('#folha .aba-cliente button:has-text("Orçamentos")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Simular serviço")'); await page.waitForTimeout(1200);

console.log('5. ordem dos campos:', await page.$$eval('#folha .rotulo, #folha .cartao-titulo',
  ns=>ns.map(n=>n.textContent.trim()).filter(Boolean).slice(0,8)));
await page.locator('#folha .campo:has-text("Descrição") input').fill('Venda de uma moto');
await page.locator('#folha .campo:has-text("Mão de obra") input').fill('1000000');
await page.waitForTimeout(700);
const vivo = (await page.textContent('#folha .cartao:has-text("Como fica para o cliente")')).replace(/\s+/g,' ');
console.log('6. resumo ao vivo:', vivo.slice(0,300));
console.log('7. 12x aparece?', /Cr[ée]dito 12x/.test(vivo), '| desconto à vista aplicado?', /10% de desconto/.test(vivo));
const grelha = await page.$$eval('#folha .cartao-bandeira', ns => ns.map(n => ({
  nome: n.querySelector('.bandeira-nome').textContent,
  linhas: [...n.querySelectorAll('.bandeira-linha')].map(l => l.textContent).slice(0, 3),
  quantas: n.querySelectorAll('.bandeira-linha').length
})));
console.log('7b. bandeiras na tela:', JSON.stringify(grelha));
await page.screenshot({ path: dir+'/p02-orcamento.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar orçamento")'); await page.waitForTimeout(1600);
console.log('8. pronto:', await page.textContent('#folhaTitulo'));
await page.screenshot({ path: dir+'/p03-pronto.png', fullPage: true });

const [dl] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#folha .btn-fantasma:has-text("Salvar o PDF no celular")')
]);
await dl.saveAs(dir + '/p-orcamento.pdf');
console.log('9. PDF:', dl.suggestedFilename(), fs.statSync(dir+'/p-orcamento.pdf').size, 'bytes');

// "Ver o PDF antes" abre numa aba em vez de baixar
const [aba] = await Promise.all([
  ctx.waitForEvent('page'),
  page.click('#folha .btn-fantasma:has-text("Ver o PDF antes")')
]);
console.log('10. abriu numa aba:', aba.url().slice(0, 10) + '...');
await browser.close();

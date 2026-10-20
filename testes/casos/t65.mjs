import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
const folha = () => page.locator('#folha');
let arquivo = amostras + '/c6-glifos.pdf';
page.on('filechooser', async fc => { await fc.setFiles(arquivo); });
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('u65'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

async function importar(a) {
  arquivo = a;
  for (let i=0;i<4 && await page.locator('#folha.aberta').count();i++) { await page.click('#cortina'); await page.waitForTimeout(600); }
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
  await page.click('#telaMais label.linha:has-text("Importar extrato")');
  await page.waitForSelector('#folha .cabeca-banco', { timeout: 60000 }); await page.waitForTimeout(600);
}
await importar(amostras+'/c6-glifos.pdf');
const itens = await page.$$eval('#folha .item-extrato', ns=>ns.map(x=>x.textContent.replace(/\s+/g,' ')));
console.log('1. descrições e categorias:');
itens.forEach(i=>console.log('   *', i));
await page.screenshot({ path: dir+'/m01-lista.png', fullPage:true });

// 2) trocar categoria -> pergunta se vale para todos
await page.click('#folha .item-extrato:nth-child(1) .etiqueta-cat'); await page.waitForTimeout(800);
console.log('2. seletor:', await page.textContent('#escolhaTitulo'), '| rodapé:', await page.textContent('#escolhaRodape'));
await page.screenshot({ path: dir+'/m02-categorias.png' });
await page.click('#escolhaLista .escolha-item:has-text("Lazer")'); await page.waitForTimeout(1000);
console.log('   virou:', await page.textContent('#folha .item-extrato:nth-child(1) .etiqueta-cat'));

// 3) criar categoria nova pelo seletor
await page.click('#folha .item-extrato:nth-child(5) .etiqueta-cat'); await page.waitForTimeout(800);
await page.click('#escolhaRodape button:has-text("Criar categoria")'); await page.waitForTimeout(900);
console.log('3. folha:', await page.textContent('#folhaTitulo'));
await folha().locator('input.entrada[type=text]').fill('Faculdade');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);
console.log('   categoria do item 5:', await page.textContent('#folha .item-extrato:nth-child(5) .etiqueta-cat'));
// e ela aparece com lápis para editar
await page.click('#folha .item-extrato:nth-child(6) .etiqueta-cat'); await page.waitForTimeout(800);
console.log('4. tem Faculdade?', await page.locator('#escolhaLista .escolha-item:has-text("Faculdade")').count(),
            '| lápis:', await page.locator('#escolhaLista .escolha-icone').count());
await page.click('#escolhaLista .escolha-item:has-text("Faculdade")'); await page.waitForTimeout(800);
console.log('   menu da criada:', await page.textContent('#escolhaTitulo'), '|',
  await page.$$eval('#escolhaLista .escolha-item .txt', ns=>ns.map(x=>x.textContent)));
await page.click('#escolhaLista .escolha-item:has-text("Excluir")'); await page.waitForTimeout(900);
console.log('5. excluir:', await page.textContent('#dialogoTitulo'));
await page.click('#dialogoAcoes button >> nth=1'); await page.waitForTimeout(900);
await browser.close();

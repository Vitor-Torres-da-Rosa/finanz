import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
const folha = () => page.locator('#folha');
let arquivo = amostras + '/c6-repetido.pdf';
page.on('filechooser', async fc => { await fc.setFiles(arquivo); });
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t66'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
async function importar(a) {
  arquivo = a;
  for (let i=0;i<6 && await page.locator('#folha.aberta').count();i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(600); }
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
  await page.click('#telaMais label.linha:has-text("Importar extrato")');
  await page.waitForSelector('#folha .cabeca-banco', { timeout: 40000 }); await page.waitForTimeout(600);
}
const cats = async () => page.$$eval('#folha .item-extrato .etiqueta-cat', ns=>ns.map(x=>x.textContent));

await importar(amostras+'/c6-repetido.pdf');
console.log('1. categorias iniciais:', (await cats()).join(', '));
await page.click('#folha .item-extrato:nth-child(1) .etiqueta-cat'); await page.waitForTimeout(800);
await page.click(`#escolhaLista .escolha-item:has-text("Alimentação")`); await page.waitForTimeout(1000);
console.log('2. perguntou?', await page.textContent('#dialogoTitulo').catch(()=>'NÃO'));
console.log('   texto:', (await page.textContent('#dialogoTexto').catch(()=>'-')).replace(/\s+/g,' '));
await page.screenshot({ path: dir+'/m10-vale-todos.png' });
await page.click('#dialogoAcoes button:has-text("Sim, todos")'); await page.waitForTimeout(1200);
console.log('3. depois:', (await cats()).join(', '));

// lança e importa de novo: a regra tem que valer sozinha
await page.click('#folha .selecao'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Criar conta")'); await page.waitForTimeout(1400);
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Sim")'); await page.waitForTimeout(2500);
await importar(amostras+'/c6-repetido.pdf');
console.log('4. na segunda importação (sem eu mexer):', (await cats()).join(', '));

// paginação com o extrato grande
await importar(amostras+'/c6-grande.pdf');
await folha().locator('input[type=password]').fill('12345678');
await page.click('#folha .btn-ouro:has-text("Abrir")');
await page.waitForSelector('#folha .paginas', { timeout: 60000 }); await page.waitForTimeout(800);
console.log('5. paginação:', (await page.textContent('#folha .paginas')).replace(/\s+/g,' '));
console.log('   itens na página:', await page.locator('#folha .item-extrato').count());
const btns = await page.$$eval('#folha .paginas .btn-mini', ns=>ns.map(b=>b.textContent+(b.disabled?' (off)':'')));
console.log('   botões:', btns);
await page.click('#folha .paginas .btn-mini:has-text("Próximos")'); await page.waitForTimeout(900);
console.log('6. próxima:', (await page.textContent('#folha .paginas')).replace(/\s+/g,' '));
await page.click('#folha .paginas .btn-mini:has-text("Próximos")'); await page.waitForTimeout(900);
await page.click('#folha .paginas .btn-mini:has-text("Anteriores")'); await page.waitForTimeout(900);
console.log('7. voltou:', (await page.textContent('#folha .paginas')).replace(/\s+/g,' '));
await page.screenshot({ path: dir+'/m11-paginas.png' });
await browser.close();

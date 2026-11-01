import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
import { tocarFab } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
const folha = () => page.locator('#folha');

await page.goto(ENDERECO, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('f' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await folha().locator('input.entrada[type=text]').first().fill('Carteira');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(800);

await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(500);
await tocarFab(page); await page.waitForTimeout(700);
await folha().locator('input.entrada[type=text]').nth(0).fill('Caçapava vizinho');
const tel = folha().locator('input[type=tel]');
await tel.click(); await tel.type('51988282222');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(900);

await page.click('#telaInicio .linha-alvo:has-text("Caçapava")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(700);
const vs = folha().locator('.valor-grande');
await vs.click(); await vs.type('38000');
await folha().locator('input.entrada[type=text]').nth(0).fill('Vazamento de água');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);
await page.click('#dialogoAcoes button >> nth=1'); await page.waitForTimeout(1200);

console.log('1. botões do rodapé:', await page.$$eval('#folha .acoes button', ns => ns.map(x=>x.textContent.trim())));
console.log('2. tem botão grande de WhatsApp:', await page.locator('#folha .btn-whats').count());
console.log('3. lápis no título:', await page.locator('#folha .folha-titulo .titulo-acao').count(),
  '| aria:', await page.getAttribute('#folha .folha-titulo .titulo-acao', 'aria-label'));
console.log('   título:', (await page.textContent('#folhaTitulo')).trim());
await page.screenshot({ path: dir + '/z01-ficha.png' });

// o lápis abre a edição e o voltar traz de volta a ficha
await page.click('#folha .folha-titulo .titulo-acao'); await page.waitForTimeout(900);
console.log('4. lápis abriu:', await page.textContent('#folhaTitulo'));
await page.goBack(); await page.waitForTimeout(900);
console.log('5. voltou para:', (await page.textContent('#folhaTitulo')).trim());
console.log('   lápis continua:', await page.locator('#folha .folha-titulo .titulo-acao').count());

// o ícone da lista de clientes continua lá
await page.goBack(); await page.waitForTimeout(900);
await page.evaluate(() => window.scrollTo(0,0)); await page.waitForTimeout(300);
console.log('6. ícones de whats na lista:', await page.locator('#telaInicio .linha-acao').count());
await browser.close();

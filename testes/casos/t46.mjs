import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
const folha = () => page.locator('#folha');
// Gerenciar tipos era um lápis ao lado do seletor. Dentro da linha do
// cartão ele desalinhava a coluna da direita, então virou a última opção
// do próprio seletor.
const abrirGerenciar = async () => {
  await page.click('#folha .parcela-linha.edita:has(.q:text-is("Tipo")) .selecao');
  await page.waitForTimeout(700);
  await page.click('#escolhaLista .escolha-item:has-text("Gerenciar tipos")');
  await page.waitForTimeout(900);
};

await page.goto(ENDERECO, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('g' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await folha().locator('input.entrada[type=text]').first().fill('Carteira');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(800);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(500);
await page.click('#fab'); await page.waitForTimeout(700);
await folha().locator('input.entrada[type=text]').nth(0).fill('Cliente A');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(900);
await page.click('#telaInicio .linha-alvo:has-text("Cliente A")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(800);

// ---- 1. o seletor de tipo ----
await page.click('#folha .selecao >> nth=0'); await page.waitForTimeout(700);
console.log('1. tipos oferecidos:', await page.$$eval('#escolhaLista .escolha-item .txt', ns => ns.map(x=>x.textContent.replace(/\s+/g,' '))));
console.log('   bolinhas:', await page.locator('#escolhaLista .marca').count());
await page.screenshot({ path: dir + '/a01-tipos.png' });
await page.click('#escolhaLista .escolha-item:has-text("Serviço")'); await page.waitForTimeout(800);

// ---- 2. o menu de gerenciar tipos ----
await abrirGerenciar();
console.log('2. título:', await page.textContent('#escolhaTitulo'));
console.log('   itens:', await page.$$eval('#escolhaLista .escolha-item .txt', ns => ns.map(x=>x.textContent.replace(/\s+/g,' '))));
console.log('   bolinhas:', await page.locator('#escolhaLista .marca').count());
console.log('   lápis:', await page.locator('#escolhaLista .escolha-icone').count());
await page.screenshot({ path: dir + '/a02-gerenciar.png' });

// cria um tipo novo
await page.click('#escolhaRodape button:has-text("Criar tipo novo")'); await page.waitForTimeout(1000);
console.log('3. folha:', await page.textContent('#folhaTitulo'));
await folha().locator('input.entrada[type=text]').nth(0).fill('Investimento');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);
await page.click('#folha .selecao >> nth=0'); await page.waitForTimeout(700);
console.log('4. tipos depois de criar:', await page.$$eval('#escolhaLista .escolha-item .txt', ns => ns.map(x=>x.textContent.replace(/\s+/g,' '))));
await page.click('#escolhaLista .escolha-item:has-text("Investimento")'); await page.waitForTimeout(800);
console.log('   escolhido:', await page.textContent('#folha .selecao >> nth=0'));

// gerenciar mostra o lápis só no criado
await abrirGerenciar();
console.log('5. itens:', await page.$$eval('#escolhaLista .escolha-item .txt', ns => ns.map(x=>x.textContent.replace(/\s+/g,' '))));
console.log('   bolinhas:', await page.locator('#escolhaLista .marca').count(), '| lápis:', await page.locator('#escolhaLista .escolha-icone').count());
await page.screenshot({ path: dir + '/a03-gerenciar2.png' });
// tocar num de fábrica avisa
await page.click('#escolhaLista .escolha-item:has-text("Venda")'); await page.waitForTimeout(900);
console.log('6. tocou em Venda:', await page.textContent('#dialogoTitulo'));
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(900);
await browser.close();

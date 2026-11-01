import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
import { irParaClientes } from '../comum.mjs';
import { tocarFab } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
const folha = () => page.locator('#folha');
const escolher = async (r) => { await page.click(`#escolhaLista .escolha-item:has-text("${r}")`); await page.waitForTimeout(700); };
const trocarValor = async (digitos) => {
  const v = folha().locator('.valor-grande');
  await v.click(); for (let i=0;i<14;i++) await v.press('Backspace'); await v.type(digitos);
  await page.waitForTimeout(400);
};
async function estado() {
  await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(800);
  const linhas = await page.$$eval('#folha .linha', ns => ns.map(x => x.textContent.replace(/\s+/g,' ')));
  await page.evaluate(() => { document.getElementById('folha').scrollTop = 0; });
  const topo = (await page.textContent('#folha .cartao')).replace(/\s+/g,' ').slice(0,90);
  return { primeira: linhas[0], ultima: linhas[linhas.length-1], quantas: linhas.length, topo: topo };
}

await page.goto(ENDERECO, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('e' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await folha().locator('input.entrada[type=text]').first().fill('Carteira');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(800);
await irParaClientes(page); await page.waitForTimeout(500);
await tocarFab(page); await page.waitForTimeout(700);
await folha().locator('input.entrada[type=text]').nth(0).fill('Edison e Sander');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(900);
await page.click('#telaInicio .linha-alvo:has-text("Edison")'); await page.waitForTimeout(700);
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(700);
const vs = folha().locator('.valor-grande');
await vs.click(); await vs.type('4500000');
await folha().locator('input.entrada[type=text]').nth(0).fill('Investimento Life Sul');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(1100);
await page.click('#folha .selecao >> nth=1'); await page.waitForTimeout(500);
await escolher('10x');
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(700);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(1600);

// paga 3.000 na parcela 1
await page.click('#folha .aba-cliente button:has-text("Pagos")'); await page.waitForTimeout(700);
await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(900);
await page.click('#folha .selecao >> nth=0'); await page.waitForTimeout(600);
await escolher('Parcela 1 de 10');
await trocarValor('300000');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
let e = await estado();
console.log('1) pagou 3.000 →', e.quantas, 'parcelas |', e.primeira.slice(0,60), '| última:', e.ultima.slice(-14), '|', e.topo);

// edita para 4.000
await page.click('#folha .aba-cliente button:has-text("Pagos")'); await page.waitForTimeout(700);
await page.click('#folha .linha >> nth=0'); await page.waitForTimeout(900);
console.log('   folha de edição:', await page.textContent('#folhaTitulo'),
  '| parcela ligada:', await page.textContent('#folha .selecao >> nth=0'));
await trocarValor('400000');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
e = await estado();
console.log('2) editou p/ 4.000 →', e.quantas, 'parcelas |', e.primeira.slice(0,60), '| última:', e.ultima.slice(-14), '|', e.topo);

// edita para 1.000 (falta mais)
await page.click('#folha .aba-cliente button:has-text("Pagos")'); await page.waitForTimeout(700);
await page.click('#folha .linha >> nth=0'); await page.waitForTimeout(900);
await trocarValor('100000');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
e = await estado();
console.log('3) editou p/ 1.000 →', e.quantas, 'parcelas | última:', e.ultima.slice(-14), '|', e.topo);

// edita para 9.000 (paga mais que a parcela)
await page.click('#folha .aba-cliente button:has-text("Pagos")'); await page.waitForTimeout(700);
await page.click('#folha .linha >> nth=0'); await page.waitForTimeout(900);
await trocarValor('900000');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
e = await estado();
console.log('4) editou p/ 9.000 →', e.quantas, 'parcelas | última:', e.ultima.slice(-14), '|', e.topo);
await page.evaluate(() => { document.getElementById('folha').scrollTop = 0; });
await page.waitForTimeout(300);
await page.screenshot({ path: dir + '/x01-editado.png' });

// exclui o pagamento
await page.click('#folha .aba-cliente button:has-text("Pagos")'); await page.waitForTimeout(700);
await page.click('#folha .linha >> nth=0'); await page.waitForTimeout(900);
await page.click('#folha .btn-perigo:has-text("Excluir pagamento")'); await page.waitForTimeout(700);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(2000);
e = await estado();
console.log('5) excluiu →', e.quantas, 'parcelas | última:', e.ultima.slice(-14), '|', e.topo);
await browser.close();

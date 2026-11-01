import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('z61' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await folha().locator('input.entrada[type=text]').first().fill('Carteira');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(800);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(500);
await tocarFab(page); await page.waitForTimeout(700);
await folha().locator('input.entrada[type=text]').nth(0).fill('Edison e Sander');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(900);
await page.click('#telaInicio .linha-alvo:has-text("Edison")'); await page.waitForTimeout(700);
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(700);
const vs = folha().locator('.valor-grande');
await vs.click(); await vs.type('5400000');
await folha().locator('input.entrada[type=text]').nth(0).fill('Investimento Life Sul');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(1100);
await page.click('#folha .selecao >> nth=1'); await page.waitForTimeout(500);
await escolher('12x');
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(700);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(1600);

// paga 3.000 na parcela 1
await page.click('#folha .aba-cliente button:has-text("Pagos")'); await page.waitForTimeout(700);
await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(900);
await page.click('#folha .selecao >> nth=0'); await page.waitForTimeout(600);
await escolher('Parcela 1 de 12');
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


// ---- agora o que o Vitor viu: todas as abertas têm que ficar em 4.500,
// com a sobra numa única última parcela ----
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(800);
const valores = await page.$$eval('#folha .linha', ns => ns.map(x => {
  const t = x.textContent.replace(/\s+/g,' ');
  const m = /R\$ ([\d.]+,\d{2})/.exec(t);
  return m ? m[1] : null;
}).filter(Boolean));
console.log('\nVALORES DAS PARCELAS:', valores.join(' | '));
const quebradas = valores.filter(v => v !== '4.500,00');
console.log('fora do padrão de 4.500:', quebradas.join(' | ') || 'nenhuma');
const soma = valores.reduce((s,v)=> s + Math.round(parseFloat(v.replace(/\./g,'').replace(',','.'))*100), 0);
console.log('quantidade:', valores.length, '| soma:', (soma/100).toFixed(2));

// ---- apagar TODAS as parcelas ----
await page.evaluate(() => { document.getElementById('folha').scrollTop = 99999; });
await page.waitForTimeout(400);
const bt = await page.$$eval('#folha .acoes button', ns=>ns.map(x=>x.textContent));
console.log('\nbotões:', bt);
await page.click('#folha .btn-perigo'); await page.waitForTimeout(900);
console.log('diálogo:', await page.textContent('#dialogoTitulo'), '|', (await page.textContent('#dialogoTexto')).replace(/\s+/g,' '));
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(1800);
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
const depois = await page.$$eval('#folha .linha', ns => ns.map(x=>x.textContent.replace(/\s+/g,' ')));
console.log('parcelas depois de apagar:', depois.length, depois.slice(0,3));
// e não podem voltar sozinhas
await page.click('#folha .aba-cliente button:has-text("Pagos")'); await page.waitForTimeout(800);
const pagos = await page.$$eval('#folha .linha', ns => ns.map(x=>x.textContent.replace(/\s+/g,' ')));
console.log('pagamentos continuam:', pagos.length);
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
console.log('parcelas ainda:', (await page.$$eval('#folha .linha', ns=>ns.length)));


// ---- caso do print: pagar e só depois apagar tudo ----
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(700);
await page.click('#folha button:has-text("Combinar parcelas")'); await page.waitForTimeout(900);
await page.click('#folha .selecao >> nth=1'); await page.waitForTimeout(500);
await escolher('12x');
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(700);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(1600);
await page.click('#folha .aba-cliente button:has-text("Pagos")'); await page.waitForTimeout(700);
await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(900);
await page.click('#folha .selecao >> nth=0'); await page.waitForTimeout(600);
await escolher('Parcela 1 de 12');
await trocarValor('300000');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(800);
console.log('\nA) com 1 paga:', await page.$$eval('#folha .linha', ns=>ns.length), 'parcelas');
await page.evaluate(() => { document.getElementById('folha').scrollTop = 99999; });
await page.waitForTimeout(400);
await page.click('#folha .btn-perigo'); await page.waitForTimeout(900);
console.log('B) diálogo:', (await page.textContent('#dialogoTexto')).replace(/\s+/g,' '));
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(1800);
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
console.log('C) parcelas depois:', await page.$$eval('#folha .linha', ns=>ns.length));
await page.click('#folha .aba-cliente button:has-text("Pagos")'); await page.waitForTimeout(800);
console.log('   pagamentos:', (await page.textContent('#folha')).match(/R\$ 3\.000,00/) ? 'o de 3.000 continua' : 'sumiu');
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
console.log('D) não voltaram:', await page.$$eval('#folha .linha', ns=>ns.length), 'parcelas');
const est = await page.evaluate(() => {
  const t = document.getElementById('folha').textContent.replace(/\s+/g,' ');
  return t.slice(0, 300);
});
console.log('E) ficha:', est);
await page.click('#folha .aba-cliente button:has-text("Pagos")'); await page.waitForTimeout(800);
console.log('F) aba Pagos:', (await page.textContent('#folha')).replace(/\s+/g,' ').slice(0,260));
await page.screenshot({ path: dir+'/j01-apagado.png', fullPage:true });
await browser.close();

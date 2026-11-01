import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
import { tocarFab } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
const folha = () => page.locator('#folha');
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('x71'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
const folhaFechou = () => page.waitForFunction(
  () => !document.getElementById('folha').classList.contains('aberta'), null, { timeout: 20000 });
for (const nome of ['C6 Bank','Nubank']) {
  await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(600);
  await folha().locator('input.entrada[type=text]').first().fill(nome);
  await page.click('#folha .btn-ouro:has-text("Salvar")');
  await folhaFechou();
  await page.locator('#telaInicio .cartao:has-text("Contas")').getByText(nome).first().waitFor({ timeout: 20000 });
}
// lança: saída no C6 e entrada no Nubank, mesma data e valor (transferência)
// mais um par que NÃO é transferência, e um gasto solto
async function lancar(tipo, valor, desc, conta) {
  // O Início não lista as descrições, então o sinal de que o lançamento
  // entrou é a tela mudar (os totais sobem). Esperar por isso, e não por um
  // tempo fixo, é o que segura o teste com doze rodando ao mesmo tempo.
  const antes = await page.textContent('#telaInicio');
  await tocarFab(page); await page.waitForTimeout(700);
  if (tipo === 'entrada') { await page.click('#folha .segmentos button:has-text("Entrada")'); await page.waitForTimeout(600); }
  await folha().locator('input[inputmode=numeric]').first().fill(valor);
  await folha().locator('input.entrada[type=text]').first().fill(desc);
  const sel = folha().locator('.selecao');
  const n = await sel.count();
  for (let i=0;i<n;i++) {
    const t = await sel.nth(i).textContent();
    if (/C6 Bank|Nubank|Carteira/.test(t)) {
      await sel.nth(i).click(); await page.waitForTimeout(600);
      await page.click(`#escolhaLista .escolha-item:has-text("${conta}")`); await page.waitForTimeout(600);
      break;
    }
  }
  await page.click('#folha .btn-ouro:has-text("Salvar")');
  await folhaFechou();
  await page.waitForFunction(
    (a) => document.getElementById('telaInicio').textContent !== a, antes, { timeout: 20000 });
}
await lancar('saida', '100000', 'Pix enviado para mim mesmo', 'C6 Bank');
await lancar('entrada', '100000', 'Pix recebido de mim mesmo', 'Nubank');
await lancar('saida', '5000', 'Padaria', 'C6 Bank');
await lancar('entrada', '5000', 'Venda de peca', 'Nubank');
await page.waitForTimeout(1200);

const tela = async () => (await page.textContent('#telaInicio')).replace(/\s+/g,' ');
console.log('1. cartão apareceu?', /Transferências entre contas/.test(await tela()));
console.log('   trecho:', (await tela()).match(/Transferências entre contas.{0,150}/)?.[0]);
const kpi = (await tela()).match(/ReceitasR\$ [\d.,]+/)?.[0] + ' | ' + (await tela()).match(/DespesasR\$ [\d.,]+/)?.[0];
console.log('2. antes de juntar:', kpi);
await page.screenshot({ path: dir+'/q01-cartao.png', fullPage:true });
await page.click('#telaInicio .cartao:has-text("Transferências entre contas") .ver-transferencias'); await page.waitForTimeout(1200);
console.log('3. folha:', await page.textContent('#folhaTitulo'));
const linhas = await page.$$eval('#folha .item-extrato', ns=>ns.map(x=>x.textContent.replace(/\s+/g,' ')));
console.log('   pares:', linhas.length);
linhas.forEach(l=>console.log('    *', l));
await page.screenshot({ path: dir+'/q02-conferir.png', fullPage:true });
// desmarca o segundo (não é transferência) e confirma
await page.click('#folha .item-extrato:nth-child(2) .caixinha'); await page.waitForTimeout(800);
console.log('4. botão:', await page.textContent('#folha .btn-ouro'));
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
console.log('5. confirmação:', (await page.textContent('#dialogoTexto')).replace(/\s+/g,' '));
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(2000);
console.log('6. cartão sumiu?', !/Transferências entre contas/.test(await tela()));
const kpi2 = (await tela()).match(/ReceitasR\$ [\d.,]+/)?.[0] + ' | ' + (await tela()).match(/DespesasR\$ [\d.,]+/)?.[0];
console.log('   depois de juntar:', kpi2);
const contas = (await tela()).match(/C6 BankConta corrente.{0,18}/)?.[0] + ' | ' + (await tela()).match(/NubankConta corrente.{0,18}/)?.[0];
console.log('   saldos:', contas);
await page.screenshot({ path: dir+'/q03-depois.png', fullPage:true });
await browser.close();

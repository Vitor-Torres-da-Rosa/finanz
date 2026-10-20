// Acréscimo do parcelamento não é uma venda à parte.
//
// Ele nasce quando a pessoa parcela com juros: vira um registro próprio
// porque é dinheiro a mais a receber. Mas aparecia como mais um produto
// na lista de registros, e — pior — na escolha "Referente a" do
// pagamento, como se o cliente pudesse estar pagando "o acréscimo".
//
// Pedido do Vitor em 20/10/2026. Agora ele é somado ao registro que o
// gerou e some da escolha.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const porDinheiro = async (loc, d) => {
  await loc.click();
  for (let i = 0; i < 16; i++) await loc.press('Backspace');
  await loc.type(d);
  await page.waitForTimeout(300);
};
const escolher = async (r) => {
  await page.click(`#escolhaLista .escolha-item:has-text("${r}")`);
  await page.waitForTimeout(700);
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t105-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// cliente + registro de R$ 1.000
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#fab'); await page.waitForTimeout(800);
await folha().locator('input.entrada[type=text]').nth(0).fill('Fabi do juliano');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1100);
await page.click('#telaInicio .linha-alvo:has-text("Fabi do juliano")'); await page.waitForTimeout(1000);
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '100000');
await folha().locator('input.entrada[type=text]').nth(0).fill('Celular');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);

// parcela em 4x com total maior: nasce o acréscimo
await page.click('#dialogoAcoes button:has-text("Combinar parcelas")'); await page.waitForTimeout(1500);
await page.click('#folha .campo:has-text("Em quantas vezes") .selecao'); await page.waitForTimeout(700);
await escolher('4x');
const campoTotal = page.locator('#folha .campo:has-text("Total a cobrar") input');
await porDinheiro(campoTotal, '135000');
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(1000);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(2500);

// --- a lista de registros junta o acréscimo no produto ---
await page.click('#folha button:has-text("Registros")'); await page.waitForTimeout(1000);
const registros = limpo(await page.textContent('#folha'));
console.log('registros:', registros.slice(registros.indexOf('Registros'), registros.indexOf('Registros') + 230));
conferir('1. o acréscimo não é mais uma linha própria',
  !/Acréscimo do parcelamento/.test(registros), registros.slice(0, 160));
conferir('2. ele aparece dentro do registro que o gerou',
  /com R\$ 350,00 de acréscimo/.test(registros),
  (registros.match(/Celular[^R]*R\$[^·]*·[^·]*·[^R]*/) || ['(não achei)'])[0].slice(0, 110));
conferir('3. e o valor da linha já é o total com acréscimo',
  /1\.350,00/.test(registros), registros.slice(0, 180));
await page.screenshot({ path: dir+'/r01-registros-juntos.png', fullPage: true });

// --- "Referente a" não oferece o acréscimo ---
await page.click('#folha button:has-text("Pagos")'); await page.waitForTimeout(900);
await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(1200);
const seletores = await page.$$('#folha .parcela-linha.edita .selecao');
// o último é o "Referente a"
await seletores[seletores.length - 1].click(); await page.waitForTimeout(900);
const opcoes = limpo(await page.textContent('#escolhaLista'));
console.log('opções de Referente a:', opcoes);
conferir('4. o acréscimo não está entre as opções',
  !/Acréscimo do parcelamento/.test(opcoes), opcoes.slice(0, 140));
conferir('5. mas o produto de verdade está',
  /Celular/.test(opcoes), opcoes.slice(0, 140));
await page.screenshot({ path: dir+'/r02-referente-sem-acrescimo.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: acréscimo junto do registro e fora da escolha');

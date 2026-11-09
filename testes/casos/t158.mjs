// Previsão de pagamento com entrada, parcelas editáveis e o combinado
// escrito por extenso.
//
// Pedido do Vitor em 07/11/2026: a venda tem entrada (paga ou não; paga,
// entra como a primeira parcela quitada). A lista mostra parcela por
// parcela, e dá para mudar o valor de qualquer uma (entrada de 5.000,
// parcelas de 1.000, as duas primeiras de 2.000). E dá para escrever "10mil
// de entrada 1000 por mês até fechar o valor total" que o app preenche.
import { chromium, dir, ENDERECO, irParaClientes } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const dinheiro = async (loc, digitos) => {
  await loc.click(); for (let i = 0; i < 14; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(200);
};
const linhas = () => page.$$eval('#folha .lista-previsao .parcela-linha', ns => ns.map(n =>
  [n.children[0].textContent, n.children[1].textContent].map(x => x.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()).join(' ')));
const resumo = async () => limpo(await page.locator('#folha .lista-previsao').locator('xpath=..').textContent());
const mudarParcela = async (n, digitos) => {
  await page.click('#folha .lista-previsao .v.editavel >> nth=' + n); await page.waitForTimeout(250);
  const inp = page.locator('#folha .entrada-parcela');
  for (let i = 0; i < 14; i++) await inp.press('Backspace');
  await inp.type(digitos); await inp.press('Enter'); await page.waitForTimeout(400);
};

await page.clock.setFixedTime(new Date(2026, 10, 7, 15, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t158-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await irParaClientes(page);
await page.click('#telaInicio .cartao-acao:has-text("+ Novo")'); await page.waitForTimeout(800);
await folha().locator('input.entrada[type=text]').first().fill('Marcos');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .linha-alvo:has-text("Marcos")'); await page.waitForTimeout(900);
await page.click('#folha button:has-text("+ Nova venda ou serviço")'); await page.waitForTimeout(900);
await dinheiro(folha().locator('.valor-grande'), '1600000');
await folha().locator('input[placeholder="Ex.: Troca de embreagem"]').fill('Kawasaki Ninja 250r 2012');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);
await page.click('#dialogoAcoes button:has-text("Combinar parcelas")'); await page.waitForTimeout(1300);

const fala = folha().getByLabel('Escreva o combinado (opcional)');

// ---- "12x de 800, as duas primeiras de 2000" ----
await fala.fill('12x de 800, as duas primeiras de 2000');
await page.click('#folha .linha-fala button:has-text("Preencher")'); await page.waitForTimeout(500);
let ls = await linhas();
conferir('1. "12x de 800, as duas primeiras de 2000": 12 parcelas, as duas primeiras de R$ 2.000,00',
  ls.length === 12 && /^1\/12 · .*R\$ 2\.000,00$/.test(ls[0]) && /^2\/12 · .*R\$ 2\.000,00$/.test(ls[1]) && /^3\/12 · .*R\$ 800,00$/.test(ls[2]) &&
  /Vai ser cobrado\s*R\$ 12\.000,00/.test(await resumo()), JSON.stringify(ls.slice(0, 3)));

// ---- o pedido do Vitor, escrito ----
await fala.fill('10mil de entrada 1000 por mês ate fechar o valor total');
await page.click('#folha .linha-fala button:has-text("Preencher")'); await page.waitForTimeout(500);
const nota = limpo(await folha().locator('.nota-fala').textContent());
conferir('2. o app entende o combinado escrito', /Entendi: entrada R\$ 10\.000,00 · parcelas de R\$ 1\.000,00 até fechar/.test(nota), nota);
conferir('3. e preenche a entrada', limpo(await folha().getByLabel('Entrada (opcional)').inputValue()).replace(/ /g, ' ') === 'R$ 10.000,00' &&
  await folha().locator('.caixa-entrada').isVisible());
ls = await linhas();
conferir('4. entrada hoje, já paga, e 6x de R$ 1.000,00 a partir do mês que vem',
  ls.length === 7 && /^Entrada · 07\/11\/2026 · paga ?R\$ 10\.000,00$/.test(ls[0]) && /^2\/7 · 07\/12\/2026 ?R\$ 1\.000,00$/.test(ls[1]) &&
  /^7\/7 · 07\/05\/2027 ?R\$ 1\.000,00$/.test(ls[6]) && /Vai ser cobrado\s*R\$ 16\.000,00/.test(await resumo()) &&
  /Entrada de R\$ 10\.000,00 \(já paga\) \+ 6x de R\$ 1\.000,00/.test(await resumo()), JSON.stringify(ls));
await page.screenshot({ path: dir + '/z66-previsao-entrada.png', fullPage: true });

// ---- mudar as duas primeiras parcelas para R$ 2.000,00 ----
await mudarParcela(0, '200000');
await mudarParcela(1, '200000');
ls = await linhas();
conferir('5. as duas primeiras de R$ 2.000,00; as outras seguem de R$ 1.000,00 até fechar',
  ls.length === 5 && /^2\/5 · .*R\$ 2\.000,00$/.test(ls[1]) && /^3\/5 · .*R\$ 2\.000,00$/.test(ls[2]) && /^5\/5 · .*R\$ 1\.000,00$/.test(ls[4]) &&
  /Vai ser cobrado\s*R\$ 16\.000,00/.test(await resumo()), JSON.stringify(ls));
conferir('6. as mudadas ficam marcadas', await page.locator('#folha .lista-previsao .v.ajustada').count() === 2);

// ---- entrada a pagar ----
await page.click('#folha .caixa-entrada button:has-text("Ainda vai pagar")'); await page.waitForTimeout(300);
ls = await linhas();
conferir('7. "Ainda vai pagar" deixa a entrada em aberto', /^Entrada · 07\/11\/2026 ?R\$ 10\.000,00$/.test(ls[0]), ls[0]);
await page.click('#folha .caixa-entrada button:has-text("Já foi paga")'); await page.waitForTimeout(300);
await page.screenshot({ path: dir + '/z67-previsao-ajustada.png', fullPage: true });
await page.locator('#folha .lista-previsao').locator('xpath=..').screenshot({ path: dir + '/z68-previsao-lista.png' });

// ---- confirmar ----
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(700);
const dlg = limpo(await page.textContent('#dialogoTitulo')) + ' | ' + limpo(await page.textContent('#dialogoTexto'));
conferir('8. a confirmação explica a entrada', /Confirmar entrada \+ 4x\?/.test(dlg) && /já paga: entra como a parcela 1, quitada/.test(dlg), dlg);
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(1600);
const ficha = limpo(await folha().textContent());
const lp = await page.$$eval('#folha .lista-parcelas .linha', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
conferir('9. na ficha: a entrada paga como parcela 1, e falta R$ 6.000,00',
  /^✓Parcela 1 de 5/.test(lp[0] || '') && /Parcela 2 de 5.*R\$ 2\.000,00/.test(lp[1] || '') && /falta R\$ 6\.000,00/.test(ficha), JSON.stringify(lp.slice(0, 3)));
await page.click('#folha .linha:has-text("Parcela 1 de 5")'); await page.waitForTimeout(900);
const obsPag = await folha().getByLabel('Observação (opcional)').inputValue();
const valPag = limpo(await folha().locator('.valor-grande').inputValue());
conferir('10. com o pagamento da entrada registrado', /Editar pagamento/.test(await page.textContent('#folhaTitulo')) && obsPag === 'Entrada' && valPag === 'R$ 10.000,00', obsPag + ' | ' + valPag);

console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\ntudo certo: entrada e parcelas sob medida');
await browser.close();
process.exit(falhas ? 1 : 0);

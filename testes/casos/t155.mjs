// Pagar uma parcela em várias vezes, com observação em cada pagamento.
//
// Pedido do Vitor em 03/11/2026: pagando menos que a parcela, ela fica
// aberta e soma os pagamentos seguintes até fechar; o que passar abate a
// próxima; tudo discriminado, com observação em cada pagamento.
import { chromium, dir, ENDERECO, irParaClientes } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const dinheiro = async (loc, digitos) => {
  await loc.click(); for (let i = 0; i < 14; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(200);
};
const linhas = () => page.$$eval('#folha .lista-parcelas .linha', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t155-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await irParaClientes(page);
await page.click('#fab'); await page.waitForTimeout(800);
await folha().locator('input.entrada[type=text]').first().fill('Edison');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .linha-alvo:has-text("Edison")'); await page.waitForTimeout(900);
await page.click('#folha button:has-text("+ Nova venda ou serviço")'); await page.waitForTimeout(900);
await dinheiro(folha().locator('.valor-grande'), '300000');
await folha().locator('input[placeholder="Ex.: Troca de embreagem"]').fill('Investimento');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);
await page.click('#dialogoAcoes button:has-text("Combinar parcelas")'); await page.waitForTimeout(1300);
await page.click('#folha .campo:has-text("Em quantas vezes") .selecao'); await page.waitForTimeout(600);
await page.click('#escolhaLista .escolha-item:has-text("3x")'); await page.waitForTimeout(700);
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(1600);

// ---- 1º pagamento: R$ 400 de R$ 1.000 ----
await page.click('#folha .linha:has-text("Parcela 1 de 3")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(1100);
await dinheiro(folha().locator('.valor-grande'), '40000');
const nota = limpo(await folha().textContent());
conferir('1. pagando menos, o padrão é deixar a parcela aberta', /Pagar o resto depois/.test(nota) && /fica aberta com R\$ 600,00/.test(nota));
await folha().getByLabel('Observação (opcional)').fill('pix do Edison');
await page.screenshot({ path: dir + '/z55-pagar-parte.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);
let ls = await linhas();
conferir('2. a parcela 1 fica aberta, faltando R$ 600,00, e o combinado não muda',
  ls.length === 3 && /Parcela 1 de 3Faltam R\$ 600,00/.test(ls[0]) && /Parcela 3 de 3.*R\$ 1\.000,00/.test(ls[2]), JSON.stringify(ls));

// ---- 2º pagamento: R$ 800 — fecha a 1 e sobra R$ 200 para a 2 ----
await page.click('#folha .linha:has-text("Parcela 1 de 3")'); await page.waitForTimeout(800);
conferir('3. a parcela aberta mostra o pagamento que já entrou, com a observação',
  /Pagamentos desta parcela.*pix do Edison.*\+ R\$ 400,00/.test(limpo(await folha().textContent())));
await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(1100);
await dinheiro(folha().locator('.valor-grande'), '80000');
await folha().getByLabel('Observação (opcional)').fill('dinheiro');
conferir('4. passando do que falta, avisa que abate a próxima', /sobraram abatem as próximas/.test(limpo(await folha().textContent())));
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);
ls = await linhas();
conferir('5. a 1 fecha com R$ 1.200,00 e a 2 cai para R$ 800,00',
  /^✓Parcela 1 de 3.*R\$ 1\.200,00/.test(ls[0]) && /Parcela 2 de 3.*R\$ 800,00/.test(ls[1]) && ls.length === 3, JSON.stringify(ls));
conferir('6. falta R$ 1.800,00 no registro', /falta R\$ 1\.800,00/.test(limpo(await folha().textContent())));

// ---- tudo discriminado ----
await page.click('#folha .linha:has-text("Parcela 1 de 3")'); await page.waitForTimeout(900);
const disc = limpo(await folha().textContent());
conferir('7. a parcela paga em duas vezes mostra os dois pagamentos e a soma',
  /pix do Edison\s*\+ R\$ 400,00\s*soma R\$ 400,00/.test(disc) && /dinheiro\s*\+ R\$ 800,00\s*soma R\$ 1\.200,00/.test(disc), disc.slice(0, 260));
await page.screenshot({ path: dir + '/z56-pagamentos-da-parcela.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: parcela paga em várias vezes');

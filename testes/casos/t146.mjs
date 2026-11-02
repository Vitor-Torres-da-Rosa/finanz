// Corrida particular paga depois vira cobrança em Serviços e Vendas.
//
// Pedido do Vitor em 02/11/2026: na corrida tem de ter a data do
// pagamento; sendo depois do dia da corrida, o app cadastra quem vai pagar
// (nome, número e endereço opcional) em Serviços e Vendas e já abre lá
// para controlar o pagamento, com o que der já preenchido.
import { chromium, dir, ENDERECO } from '../comum.mjs';
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
  await loc.click(); for (let i = 0; i < 12; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(150);
};
const br = (iso) => iso.split('-').reverse().join('/');

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t146-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

const hoje = await page.evaluate(() => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
const depois = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() + 10); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });

await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#telaInicio [data-modulo="uber"]'); await page.waitForTimeout(900);

// ---- corrida do aplicativo: nada de data de pagamento ----
await page.click('#fab'); await page.waitForTimeout(900);
conferir('1. corrida de aplicativo não pede data de pagamento',
  !(await folha().getByLabel('Data do pagamento').isVisible()));
await page.click('#folha .chip:has-text("Particular")'); await page.waitForTimeout(200);
conferir('2. Particular mostra a data do pagamento, no dia da corrida',
  await folha().getByLabel('Data do pagamento').isVisible() &&
  (await folha().getByLabel('Data do pagamento').inputValue()) === hoje);

await dinheiro(folha().locator('.valor-grande'), '5000');
await folha().getByLabel('Distância (km)').fill('12');
await folha().getByLabel('Observação (opcional)').fill('aeroporto');
await folha().getByLabel('Data do pagamento').fill(depois);
await page.waitForTimeout(200);
conferir('3. com data depois, o app avisa que vai cadastrar a cobrança',
  /Vai pagar depois/.test(limpo(await folha().textContent())));
await page.screenshot({ path: dir + '/z37-corrida-paga-depois.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar corrida")'); await page.waitForTimeout(1300);

const tituloCli = limpo(await page.textContent('#folhaTitulo'));
const corpoCli = limpo(await folha().textContent());
conferir('4. abre o cadastro de quem vai pagar, com a corrida descrita',
  tituloCli === 'Quem vai pagar a corrida?' && /Corrida de R\$ 50,00/.test(corpoCli) && new RegExp('pagar em ' + br(depois)).test(corpoCli),
  tituloCli + ' · ' + corpoCli.slice(0, 120));
conferir('5. a observação da corrida já vem como anotação',
  (await folha().locator('input[placeholder="Anotação (opcional)"]').inputValue()) === 'Corrida: aeroporto');
await folha().locator('input[placeholder="Nome do cliente"]').fill('Joana Lima');
await folha().locator('input[type=tel]').first().fill('51999887766');
await folha().locator('input[placeholder^="Rua, número"]').fill('Rua A, 10');
await page.screenshot({ path: dir + '/z38-quem-vai-pagar.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar e cobrar")'); await page.waitForTimeout(2200);

const cab = limpo(await page.textContent('#telaInicio .modulo-cabecalho').catch(() => ''));
const ficha = limpo(await folha().textContent());
conferir('6. vai para Serviços e Vendas, com a ficha do cliente aberta nas parcelas',
  /Serviços e Vendas/.test(cab) && /Joana Lima/.test(ficha) &&
  new RegExp('Parcela 1 de 1\\s*Vence em ' + br(depois)).test(ficha) && /R\$ 50,00/.test(ficha), cab + ' · ' + ficha.slice(0, 200));
await page.screenshot({ path: dir + '/z39-cobranca-criada.png', fullPage: true });

// ---- segunda corrida, mesma cliente, escolhida na lista ----
for (let i = 0; i < 3 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
await page.click('#telaInicio .modulo-voltar'); await page.waitForTimeout(700);
await page.click('#telaInicio [data-modulo="uber"]'); await page.waitForTimeout(900);
await page.click('#fab'); await page.waitForTimeout(900);
conferir('7. a próxima corrida já vem em Particular', (await page.$eval('#folha .chip[aria-pressed="true"], #folha .chip.ativo', b => b.textContent).catch(() => '')).includes('Particular'));
await dinheiro(folha().locator('.valor-grande'), '3000');
await folha().getByLabel('Data do pagamento').fill(depois);
await page.click('#folha .btn-ouro:has-text("Salvar corrida")'); await page.waitForTimeout(1300);
await page.click('#folha .chip:has-text("Joana Lima")'); await page.waitForTimeout(2200);
const ficha2 = limpo(await folha().textContent());
conferir('8. escolhendo quem já é cliente, a corrida entra na ficha dela',
  /Joana Lima/.test(ficha2) && /TOTAL\s*R\$ 80,00/i.test(ficha2), ficha2.slice(0, 160));

// ---- os números não contam duas vezes ----
for (let i = 0; i < 3 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
await page.click('#telaInicio .modulo-voltar'); await page.waitForTimeout(700);
const hub = limpo(await page.textContent('#telaInicio'));
conferir('9. Serviços e Vendas mostra o total a receber das corridas',
  /Serviços e Vendas.*Total a receber\s*R\$ 80,00/.test(hub), (hub.match(/Serviços e Vendas.{0,80}/) || [''])[0]);
const resumo = limpo(await page.textContent('#telaInicio .cartao-resumo-emp'));
conferir('10. o faturamento conta as corridas uma vez só, e nada como recebido',
  /Faturamento dos três\s*R\$ 80,00/.test(resumo) && /Recebido\s*R\$ 0,00/.test(resumo) && /Total a receber\s*R\$ 80,00/.test(resumo), resumo);
await page.screenshot({ path: dir + '/z40-hub.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: corrida particular paga depois');

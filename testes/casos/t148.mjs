// Radar de contas: as contas do mês sem DDA.
//
// Pedido do Vitor em 03/11/2026 ("1 e 3 pode fazer"): o app reconhece no
// histórico o que sai uma vez por mês perto do mesmo dia (mesmo com valor
// mudando), monta a lista do mês, marca como paga quando aparece e avisa
// do que costuma já ter saído; e o que falta pagar entra na previsão do mês.
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

// Dia 20 do mês, 15h: a luz (dia 10) já devia ter saído; o aluguel (25) não.
const agora = new Date(); agora.setDate(20); agora.setHours(15, 0, 0, 0);
await page.clock.setFixedTime(agora);
const dia = (mesesAtras, d) => {
  const x = new Date(agora.getFullYear(), agora.getMonth() - mesesAtras, d);
  return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0');
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t148-' + Math.random().toString(36).slice(2) + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

const suf = Math.random().toString(36).slice(2, 8);
const conta = 'cc-t148-' + suf, cartao = 'cart-t148-' + suf;
let n = 0;
const lanc = (data, valor, descricao, categoria, tipo = 'saida', contaId = conta) =>
  ({ id: 'l-t148-' + suf + '-' + (n++), tipo, valor, descricao, categoria, data, contaId, criadoEm: Date.now() + n });
const L = [];
for (const m of [3, 2, 1]) L.push(lanc(dia(m, 5), 500000, 'SALARIO EMPRESA', 'Salário', 'entrada'));
L.push(lanc(dia(0, 5), 500000, 'SALARIO EMPRESA', 'Salário', 'entrada'));
// Luz: valor muda, dia perto do 10. Este mês ainda não saiu.
L.push(lanc(dia(3, 9), 18040, 'PIX ENVIADO CEEE EQUATORIAL', 'Casa'));
L.push(lanc(dia(2, 11), 21010, 'PIX ENVIADO CEEE EQUATORIAL', 'Casa'));
L.push(lanc(dia(1, 10), 19500, 'PIX ENVIADO CEEE EQUATORIAL', 'Casa'));
// Internet: todo dia 5, e este mês já saiu.
for (const m of [3, 2, 1, 0]) L.push(lanc(dia(m, 5), 9990, 'VIVO FIBRA', 'Casa'));
// Aluguel: dia 1, e este mês está lançado para o dia 25 (futuro).
L.push(lanc(dia(2, 1), 150000, 'PIX ENVIADO JOAO IMOVEIS', 'Moradia'));
L.push(lanc(dia(1, 1), 150000, 'PIX ENVIADO JOAO IMOVEIS', 'Moradia'));
L.push(lanc(dia(0, 25), 150000, 'PIX ENVIADO JOAO IMOVEIS', 'Moradia'));
// Mercado várias vezes por mês: compra, não conta.
for (const m of [2, 1]) for (const d of [3, 10, 17, 24]) L.push(lanc(dia(m, d), 25000, 'MERCADO ZAFFARI', 'Alimentação'));
// Uma vez só, e uma que parou: fora do radar.
L.push(lanc(dia(1, 15), 5590, 'NETFLIX', 'Assinaturas'));
L.push(lanc(dia(4, 8), 12000, 'ACADEMIA FORCA', 'Saúde'));
L.push(lanc(dia(3, 8), 12000, 'ACADEMIA FORCA', 'Saúde'));
// Cartão: compra no mês passado, fatura vence dia 10 deste mês.
L.push(lanc(dia(1, 15), 30000, 'LOJA RENNER', 'Vestuário', 'saida', cartao));

await page.evaluate((args) => new Promise(res => {
  const dados = {
    contas: [{ id: args.conta, nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 },
             { id: args.cartao, nome: 'Nubank', tipo: 'Cartão de crédito', saldoInicial: 0, fechamento: 3, vencimento: 10, limite: 500000 }],
    lancamentos: args.L };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}), { conta, cartao, L });
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);

// ---- Planejar ----
await page.click('#navegacao button:has-text("Planejar")'); await page.waitForTimeout(1200);
const plan = limpo(await page.textContent('#telaPlanejamento .cartao-contas'));
console.log('contas:', plan.slice(0, 500));
conferir('1. a luz entra, com valor de costume, e avisa que ainda não apareceu',
  /Ceee Equatorial\s*costuma vencer dia 10 · ainda não apareceu\s*~R\$ 195,00/.test(plan));
conferir('2. a internet deste mês já está paga', /Vivo Fibra\s*paga em 05/.test(plan));
conferir('3. o aluguel lançado para o dia 25 aparece agendado', /Joao Imoveis\s*agendada para 25/.test(plan));
conferir('4. a fatura do cartão que vence no mês entra', /Fatura Nubank\s*costuma vencer dia 10 · ainda não apareceu\s*R\$ 300,00/.test(plan));
conferir('5. compra de mercado, gasto de uma vez só e conta que parou ficam de fora',
  !/Zaffari|Netflix|Academia/i.test(plan));
conferir('6. falta pagar R$ 495,00 em 2 das 4 contas',
  /Falta pagar\s*R\$ 495,00/.test(plan) && /Contas\s*2 de 4/.test(plan), (plan.match(/Falta pagar.{0,60}/) || [''])[0]);
await page.screenshot({ path: dir + '/z46-contas-do-mes.png', fullPage: true });

// ---- tirar do radar e trazer de volta ----
await page.click('#telaPlanejamento .cartao-contas .linha:has-text("Ceee Equatorial")'); await page.waitForTimeout(800);
const ficha = limpo(await page.textContent('#folha'));
conferir('7. a conta mostra os meses de onde saiu o valor', /Costuma vencer\s*dia 10/.test(ficha) && /R\$ 180,40/.test(ficha) && /R\$ 210,10/.test(ficha), ficha.slice(0, 200));
await page.click('#folha .btn-perigo:has-text("Tirar do radar")'); await page.waitForTimeout(1000);
let plan2 = limpo(await page.textContent('#telaPlanejamento .cartao-contas'));
conferir('8. tirada do radar, ela some e o que falta pagar cai', !/Ceee/.test(plan2) && /Falta pagar\s*R\$ 300,00/.test(plan2) && /1 fora do radar/.test(plan2));
await page.click('#telaPlanejamento .contas-fora'); await page.waitForTimeout(600);
await page.click('#escolhaLista .escolha-item >> nth=0'); await page.waitForTimeout(900);
plan2 = limpo(await page.textContent('#telaPlanejamento .cartao-contas'));
conferir('9. e dá para trazer de volta', /Ceee Equatorial/.test(plan2) && /Falta pagar\s*R\$ 495,00/.test(plan2));

// ---- Visão geral: contas e sobra prevista ----
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
const inicio = limpo(await page.textContent('#telaInicio'));
const desp = (inicio.match(/Despesas\s*R\$ [\d.,]+.{0,40}?Estimativa\s*R\$ ([\d.,]+)/) || [])[1];
const valorDesp = desp ? Number(desp.replace(/\./g, '').replace(',', '.')) : 0;
// Saiu este mês: internet 99,90. Falta: 495,00. Agendado (25) já é lançamento do mês: 1.500,00.
conferir('10. a estimativa de despesas desconta o que falta pagar', valorDesp >= 99.90 + 1500 + 495, 'estimativa ' + desp);
conferir('11. o Início mostra as contas a pagar e a sobra prevista',
  /Contas do mês/.test(inicio) && /Falta pagar\s*R\$ 495,00/.test(inicio) && /Sobra prevista no fim do mês\s*(− )?R\$/.test(inicio),
  (inicio.match(/Contas do mês.{0,200}/) || [''])[0]);
await page.screenshot({ path: dir + '/z47-inicio-contas.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: radar de contas');

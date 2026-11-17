// Radar de contas: as contas do mês sem DDA.
//
// Desde 17/11/2026 a lista saiu das telas (pedido do Vitor: "pode remover
// tudo"). O radar segue por trás só para a estimativa de despesas.
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

// ---- 17/11/2026: "Contas do mês" saiu das telas a pedido do Vitor ----
await page.click('#navegacao button:has-text("Planejar")'); await page.waitForTimeout(1200);
const plan = limpo(await page.textContent('#telaPlanejamento'));
conferir('1. Planejar não tem mais "Contas do mês"', !/Contas do mês/.test(plan) &&
  !(await page.locator('#telaPlanejamento .cartao-contas').count()), plan.slice(0, 160));

await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
const inicio = limpo(await page.textContent('#telaInicio'));
conferir('2. o Início também não, nem a sobra prevista', !/Contas do mês/.test(inicio) && !/Sobra prevista/.test(inicio));
const desp = (inicio.match(/Despesas\s*R\$ [\d.,]+.{0,40}?Estimativa\s*R\$ ([\d.,]+)/) || [])[1];
const valorDesp = desp ? Number(desp.replace(/\./g, '').replace(',', '.')) : 0;
// Saiu este mês: internet 99,90. Falta: 495,00. Agendado (25): 1.500,00.
conferir('3. a estimativa de despesas continua contando o que costuma sair', valorDesp >= 99.90 + 1500 + 495, 'estimativa ' + desp);

await page.click('#telaInicio .kpi-analises'); await page.waitForTimeout(1500);
const analise = limpo(await page.textContent('#folha'));
conferir('4. a análise não avisa mais "ainda não foi paga"', !/ainda não foi paga/.test(analise) && !/Ver contas do mês/.test(analise), analise.slice(0, 160));
await page.screenshot({ path: dir + '/z47-sem-contas-do-mes.png' });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: contas do mês fora das telas');

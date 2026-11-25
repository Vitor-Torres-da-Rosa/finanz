// Pedido do Vitor em 19/11/2026: do lado de cada conta, há quantos dias foi
// atualizado o extrato, para saber se precisa importar de novo.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.clock.setFixedTime(new Date(2026, 10, 19, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('finanz.privado', '0'); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t181-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const conta = (id, nome, tipo) => ({ id: m + id, nome, tipo: tipo || 'Conta corrente', saldoInicial: 0 });
  const imp = (id, c, de, ate) => ({ id: m + id, contaId: m + c, banco: 'X', arquivo: id + '.pdf', quando: Date.now(), quantos: 1, de, ate });
  const L = (id, c, data, imp) => ({ id: m + id, tipo: 'saida', valor: 1000, descricao: 'Compra ' + id, categoria: 'Outros', data, contaId: m + c, importacaoId: imp ? m + imp : undefined });
  const dados = {
    contas: [conta('in', 'Banco Inter'), conta('c6', 'C6 Bank'), conta('it', 'Itaú'), conta('cart', 'Carteira', 'Dinheiro físico'), conta('nu', 'Nubank')],
    importacoes: [imp('i1', 'in', '2026-11-01', '2026-11-17'), imp('i0', 'in', '2026-10-01', '2026-10-31'),
                  imp('i2', 'c6', '2026-10-20', '2026-11-05'), imp('i3', 'it', '2026-09-01', '2026-10-15')],
    lancamentos: [L('a', 'in', '2026-11-17', 'i1'), L('b', 'c6', '2026-11-05', 'i2'), L('c', 'it', '2026-10-15', 'i3'),
                  L('d', 'nu', '2026-11-18')] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);

const contas = page.locator('#telaInicio .cartao', { has: page.locator('.linha-titulo', { hasText: 'Total em contas' }) });
const idade = async (nome) => {
  const l = contas.locator('.linha', { hasText: nome }).first();
  const e = l.locator('.idade-extrato');
  if (!(await e.count())) return null;
  return { t: limpo(await e.textContent()), cls: await e.getAttribute('class') };
};
const inter = await idade('Banco Inter'), c6 = await idade('C6 Bank'), itau = await idade('Itaú'), cart = await idade('Carteira'), nu = await idade('Nubank');
console.log(JSON.stringify({ inter, c6, itau, cart, nu }));
conferir('1. Inter: extrato até 17/11, há 2 dias, em dia (verde)', inter && inter.t === '2 dias' && /em-dia/.test(inter.cls), inter && inter.t);
conferir('2. C6: até 05/11, 14 dias, hora de atualizar (dourado)', c6 && c6.t === '14 dias' && /atencao/.test(c6.cls), c6 && c6.t);
conferir('3. Itaú: até 15/10, 35 dias, bem velho (vermelho)', itau && itau.t === '35 dias' && /velho/.test(itau.cls), itau && itau.t);
conferir('4. a carteira sem lançamento diz "sem lançamento"', cart && cart.t === 'sem lançamento', cart && cart.t);
conferir('5. conta sem extrato importado diz "sem extrato"', nu && nu.t === 'sem extrato', nu && nu.t);
const tipo = limpo(await contas.locator('.linha', { hasText: 'Banco Inter' }).first().locator('.linha-sub').textContent());
const nomeT = limpo(await contas.locator('.linha', { hasText: 'Banco Inter' }).first().locator('.linha-titulo').textContent());
conferir('7. o nome fica inteiro e a etiqueta embaixo do saldo', nomeT === 'Banco Inter' && (await contas.locator('.linha', { hasText: 'Banco Inter' }).first().locator('.linha-fim .idade-extrato').count()) === 1, nomeT);
conferir('6. o tipo da conta continua ali', tipo === 'Conta corrente', tipo);
await contas.scrollIntoViewIfNeeded();
await contas.screenshot({ path: dir + '/z111-idade-extrato.png' });

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

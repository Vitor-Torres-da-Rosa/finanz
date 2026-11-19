// Pedido do Vitor em 19/11/2026: a fatura do cartão mês a mês, arrastando
// para o lado; cada mês diz se está paga e a conta da fatura; e compra na
// parcela 5 de 10 oferece lançar as outras 5 nas próximas faturas,
// perguntando antes.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, hasTouch: true })).newPage();
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t183-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const banco = m + 'in', cart = m + 'c6';
  const L = (id, conta, tipo, valor, descricao, data, cat) => ({ id: m + id, tipo, valor, descricao, categoria: cat || 'Outros', data, contaId: conta });
  const dados = {
    contas: [{ id: banco, nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 900000 },
             { id: cart, nome: 'C6 Carbon', tipo: 'Cartão de crédito', saldoInicial: 0, fechamento: '3', vencimento: '10', limite: 1000000 }],
    lancamentos: [
      L('a', cart, 'saida', 218055, 'JIM.COM* VITOR TORRES - Parcela 5/10', '2026-11-03', 'Compras'),
      L('b', cart, 'saida', 28180, 'Mercado Bom Preço', '2026-11-03', 'Alimentação'),
      L('c', banco, 'saida', 246235, 'Pagamento fatura cartão C6', '2026-11-10', 'Outros'),
      L('d', cart, 'saida', 2000, 'Uber viagem', '2026-11-15', 'Transporte'),
      L('e', cart, 'saida', 15000, 'Loja antiga', '2026-10-02', 'Compras')] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
await page.click('#telaInicio .linha-alvo:has-text("C6 Carbon")'); await page.waitForTimeout(1500);

const ativa = async () => limpo(await page.textContent('#folha .mes-fatura.ativa').catch(() => ''));
const painel = async () => limpo(await page.textContent('#folha .painel-fatura').catch(() => ''));
const meses = limpo(await page.textContent('#folha .meses-fatura').catch(() => ''));
conferir('1. os meses de fatura ficam numa faixa no topo', /outubro.*novembro.*dezembro/.test(meses), meses);
conferir('2. abre na fatura aberta (dezembro)', (await ativa()) === 'dezembro' && /Fatura aberta/.test(await painel()), (await ativa()) + ' · ' + (await painel()).slice(0, 80));
await page.locator('#folha .cartao-faturas-mes').scrollIntoViewIfNeeded();
await page.locator('#folha .cartao-faturas-mes').screenshot({ path: dir + '/z113-fatura-dezembro.png' });

// Arrasta para a direita: volta para novembro.
const arrastar = async (dx) => page.evaluate((dx) => {
  const alvo = document.querySelector('#folha .painel-fatura');
  const r = alvo.getBoundingClientRect(); const x = r.left + r.width / 2, y = r.top + 30;
  const t = (cx) => new Touch({ identifier: 1, target: alvo, clientX: cx, clientY: y });
  alvo.dispatchEvent(new TouchEvent('touchstart', { bubbles: true, touches: [t(x)], changedTouches: [t(x)] }));
  alvo.dispatchEvent(new TouchEvent('touchend', { bubbles: true, touches: [], changedTouches: [t(x + dx)] }));
}, dx);
await arrastar(160); await page.waitForTimeout(700);
const nov = await painel();
console.log('novembro:', nov);
conferir('3. arrastando para o lado, vai para novembro', (await ativa()) === 'novembro', await ativa());
conferir('4. novembro: paga, com a conta da fatura e o valor a pagar zerado',
  /Fatura paga/.test(nov) && /Compras e débitos R\$ 2\.462,35/.test(nov) && /das quais parcelas R\$ 2\.180,55/.test(nov) &&
  /Pago em 10\/11\/2026 · Banco Inter − R\$ 2\.462,35/.test(nov) && /Valor a pagar R\$ 0,00/.test(nov), nov.slice(0, 220));
const lanc = limpo(await page.textContent('#folha .cartao-faturas-mes').catch(() => ''));
conferir('5. os lançamentos da fatura aparecem, com a parcela do lado', /JIM\.COM\* VITOR TORRES - Parcela 5\/10/.test(lanc) && /Parcela 5 de 10/.test(lanc));
const falt = limpo(await page.textContent('#folha .parcelas-faltando').catch(() => ''));
conferir('6. reconhece a compra na parcela 5 de 10 e oferece lançar 6/10 a 10/10', /Parcela 5 de 10 · faltam 5/.test(falt) && /Lançar 6\/10 a 10\/10/.test(falt), falt);
await page.locator('#folha .cartao-faturas-mes').screenshot({ path: dir + '/z114-fatura-novembro.png' });

await page.click('#folha .parcelas-faltando button:has-text("Lançar 6/10")'); await page.waitForTimeout(700);
const pergunta = limpo(await page.textContent('#dialogoAcoes').catch(() => ''));
conferir('7. pergunta antes, dizendo em quais faturas vai', /Lançar as parcelas 6\/10 a 10\/10\?/.test(pergunta) && /de dezembro a abril de 2027/.test(pergunta), pergunta.slice(0, 220));
await page.click('#dialogoAcoes button:has-text("Lançar")'); await page.waitForTimeout(1500);

const criadas = await page.evaluate(() => {
  const d = JSON.parse(localStorage.getItem(Object.keys(localStorage).find(k => /^caixa\.dados/.test(k)) || '{}') || '{}');
  return (d.lancamentos || []).filter(l => /JIM\.COM/.test(l.descricao)).map(l => l.descricao.replace(/.*Parcela /, '') + '@' + l.data).sort();
}).catch(() => []);
console.log('criadas:', criadas.join(' '));
conferir('8. lançou 5 parcelas, uma em cada fatura seguinte',
  criadas.join(' ') === '10/10@2027-04-03 5/10@2026-11-03 6/10@2026-12-03 7/10@2027-01-03 8/10@2027-02-03 9/10@2027-03-03', criadas.join(' '));
const ativaDepois = await ativa();
conferir('9. continua em novembro e a caixa de parcelas some', ativaDepois === 'novembro' && (await page.locator('#folha .parcelas-faltando').count()) === 0, ativaDepois);
// Dezembro agora tem a 6/10 e não pede para lançar de novo.
await page.click('#folha .mes-fatura:has-text("dezembro")'); await page.waitForTimeout(700);
const dez = limpo(await page.textContent('#folha .cartao-faturas-mes'));
conferir('10. dezembro ganhou a 6/10 e não pede para lançar o que já está lá', /Parcela 6\/10/.test(dez) && (await page.locator('#folha .parcelas-faltando').count()) === 0, dez.slice(0, 160));
const mesesDepois = limpo(await page.textContent('#folha .meses-fatura'));
conferir('11. as faturas futuras aparecem na faixa', /abril\s*2027/.test(mesesDepois), mesesDepois);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

// Pedido do Vitor em 25/11/2026: o "Orçamento do mês estourado" ganha a barra
// do planejado, onde mais saiu e dois caminhos: ver as saídas ou rever o
// planejamento.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.clock.setFixedTime(new Date(2026, 10, 25, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('finanz.privado', '0'); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t190-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const L = (id, valor, cat, data) => ({ id: m + id, tipo: 'saida', valor, descricao: cat + ' ' + id, categoria: cat, data, contaId: m + 'in' });
  const dados = {
    contas: [{ id: m + 'in', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 2000000 }],
    orcamentos: { geral: 500000, categorias: { 'Alimentação': 150000 } },
    lancamentos: [L('a', 320000, 'Moradia', '2026-11-05'), L('b', 250000, 'Alimentação', '2026-11-10'), L('c', 168613, 'Transporte', '2026-11-12'),
                  { id: m + 'r', tipo: 'entrada', valor: 900000, descricao: 'Salário', categoria: 'Salário', data: '2026-11-05', contaId: m + 'in' }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1200);
await page.click('#telaInicio .marca-sino'); await page.waitForTimeout(1500);
if (await page.locator('#folha button:has-text("Ver a análise de novembro")').count()) { await page.click('#folha button:has-text("Ver a análise de novembro")'); await page.waitForTimeout(1500); }
const card = page.locator('#folha .achado', { hasText: 'Seus gastos de novembro' }).first();
await card.scrollIntoViewIfNeeded().catch(() => {});
const txt = limpo(await card.textContent().catch(() => ''));
console.log('cartão:', txt);
conferir('1. um relatório só: o que saiu, o orçamento em cima, com a barra', /Saiu\s*R\$ 7\.386,13/.test(txt) && /Acima do orçamento\s*\+R\$ 2\.386,13/.test(txt) &&
  /Planejado R\$ 5\.000,00\s*Gasto R\$ 7\.386,13 · 148%/.test(txt) && (await card.locator('.barra-orcamento .passou').count()) === 1, txt.slice(0, 200));
conferir('1b. a rosca no meio', (await card.locator('.rosca-achado svg').count()) === 1);
conferir('2. embaixo, as categorias, com o teto quando tem', /Moradia\s*novembro R\$ 3\.200,00\s*R\$ 3\.200,00/.test(txt) && /Alimentação\s*novembro R\$ 2\.500,00 · teto R\$ 1\.500,00/.test(txt), txt);
conferir('2b. o cartão separado de "orçamento estourado" não aparece mais', !(await page.locator('#folha .achado', { hasText: 'Orçamento do mês estourado' }).count()));
const botoes = await card.locator('.acoes-achado button').allTextContents();
conferir('3. dois caminhos: ver as saídas e rever o planejamento', botoes.join('|') === 'Ver as saídas|Rever o planejamento', botoes.join('|'));
await card.screenshot({ path: dir + '/z130-orcamento-estourado.png' });
const metaCard = limpo(await page.locator('#folha .achado', { hasText: 'Faltou para a meta de economia' }).first().textContent().catch(() => ''));
console.log('meta:', metaCard);
conferir('3b. a meta de economia fala claro: o que entrou, saiu, sobrou e a meta em reais',
  /R\$ 186,13\s*faltam para chegar na meta de 20%/.test(metaCard) && /Entraram R\$ 9\.000,00 e saíram R\$ 7\.386,13\. Sobraram R\$ 1\.613,87 \(18%\)\. Sua meta é guardar 20% do que entra, ou seja, R\$ 1\.800,00\./.test(metaCard), metaCard.slice(0, 260));
await card.locator('.acoes-achado button:has-text("Rever o planejamento")').click(); await page.waitForTimeout(1500);
const titulo = limpo(await page.textContent('#folhaTitulo').catch(() => ''));
conferir('4. "Rever o planejamento" abre o orçamento', /Orçamento/i.test(titulo), titulo);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

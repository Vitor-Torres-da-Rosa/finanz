// Pedido do Vitor em 25/11/2026: na análise, um cartão com tudo o que subiu
// em relação ao mês passado, categoria por categoria; a categoria abre as
// subcategorias, a subcategoria abre os gastos, e o gasto abre a fonte.
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t191-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const L = (id, valor, cat, sub, data, extra) => Object.assign({ id: m + id, tipo: 'saida', valor, descricao: (sub || cat) + ' ' + id, categoria: cat, subcategoria: sub || '', data, contaId: m + 'in' }, extra || {});
  const dados = {
    contas: [{ id: m + 'in', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 2000000 }],
    importacoes: [{ id: m + 'imp', contaId: m + 'in', banco: 'Inter', arquivo: 'nov.pdf', quando: Date.now(), quantos: 1, de: '2026-11-10', ate: '2026-11-10' }],
    lancamentos: [
      // outubro
      L('o1', 10000, 'Impostos e taxas', 'Taxas', '2026-10-10'), L('o2', 30000, 'Educação', 'Curso', '2026-10-12'),
      L('o3', 200000, 'Moradia', 'Aluguel', '2026-10-05'),
      // novembro
      L('n1', 25000, 'Impostos e taxas', 'Taxas', '2026-11-10', { descricao: 'Taxa do cartório', importacaoId: m + 'imp' }),
      L('n2', 12995, 'Impostos e taxas', 'IPVA', '2026-11-11', { descricao: 'IPVA parcela' }),
      L('n3', 30854, 'Educação', 'Curso', '2026-11-12'),
      L('n4', 150000, 'Moradia', 'Aluguel', '2026-11-05')] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1200);
await page.click('#telaInicio .marca-sino'); await page.waitForTimeout(1500);
if (await page.locator('#folha button:has-text("Ver a análise de novembro")').count()) { await page.click('#folha button:has-text("Ver a análise de novembro")'); await page.waitForTimeout(1500); }
const card = page.locator('#folha .achado', { hasText: 'Seus gastos de novembro' }).first();
const txt = limpo(await card.textContent().catch(() => ''));
console.log('cartão:', txt.slice(0, 300));
conferir('1. em cima, o que saiu e a diferença para outubro', /Seus gastos de novembro\s*R\$ 2\.188,49\s*R\$ 211,51 a menos que em outubro/.test(txt) && /vs\. outubro\s*−R\$ 211,51/.test(txt), txt.slice(0, 160));
conferir('1b. a rosca no meio', (await card.locator('.rosca-achado svg').count()) === 1);
const cats = await card.locator('.comparativo > .comp-linha').allTextContents();
conferir('2. embaixo, todas as categorias, da que mais subiu para a que mais caiu',
  cats.length === 3 && /Impostos e taxas\s*novembro R\$ 379,95 · outubro R\$ 100,00\s*\+R\$ 279,95/.test(limpo(cats[0])) && /Educação/.test(cats[1]) &&
  /Moradia\s*novembro R\$ 1\.500,00 · outubro R\$ 2\.000,00\s*−R\$ 500,00/.test(limpo(cats[2])), cats.map(limpo).join(' | '));
conferir('2b. subiu em vermelho, caiu em verde', (await card.locator('.comparativo > .comp-linha .comp-dif.subiu').count()) === 2 &&
  (await card.locator('.comparativo > .comp-linha .comp-dif.caiu').count()) === 1);
await card.locator('.comparativo > .comp-linha', { hasText: 'Impostos e taxas' }).click(); await page.waitForTimeout(400);
const subs = await card.locator('.comparativo > .comp-dentro:not([hidden]) > .comp-linha').allTextContents();
conferir('3. tocando na categoria, abrem as subcategorias com os valores', subs.length === 2 &&
  /Taxas\s*novembro R\$ 250,00 · outubro R\$ 100,00\s*\+R\$ 150,00/.test(limpo(subs[0])) && /IPVA\s*novembro R\$ 129,95 · outubro R\$ 0,00\s*\+R\$ 129,95/.test(limpo(subs[1])), subs.map(limpo).join(' | '));
await card.locator('.comp-dentro .comp-linha', { hasText: 'Taxas' }).first().click(); await page.waitForTimeout(400);
const gastos = await card.locator('.comp-gasto').allTextContents();
conferir('4. tocando na subcategoria, aparecem os gastos, com a fonte', gastos.some(g => /Taxa do cartório\s*10\/11\/2026 · Banco Inter\s*extrato\s*R\$ 250,00/.test(limpo(g))), gastos.map(limpo).join(' | '));
await card.screenshot({ path: dir + '/z131-gastou-mais.png' });
await card.locator('.comp-gasto', { hasText: 'Taxa do cartório' }).click(); await page.waitForTimeout(1500);
const fonte = limpo(await page.textContent('#folha').catch(() => ''));
conferir('5. o gasto do extrato abre o extrato de onde veio', /nov\.pdf/.test(fonte) && /Taxa do cartório/.test(fonte), fonte.slice(0, 120));
await page.goBack(); await page.waitForTimeout(1500);
const voltou = limpo(await page.textContent('#folhaTitulo').catch(() => ''));
conferir('6. voltando, cai de novo na análise', /Análise de novembro/.test(voltou), voltou);
const card2 = page.locator('#folha .achado', { hasText: 'Seus gastos de novembro' }).first();
await card2.locator('.comparativo > .comp-linha', { hasText: 'Impostos e taxas' }).click(); await page.waitForTimeout(300);
await card2.locator('.comp-dentro .comp-linha', { hasText: 'IPVA' }).first().click(); await page.waitForTimeout(300);
await card2.locator('.comp-gasto', { hasText: 'IPVA parcela' }).click(); await page.waitForTimeout(1500);
const lanc = limpo(await page.textContent('#folhaTitulo').catch(() => ''));
conferir('7. o gasto lançado à mão abre o próprio lançamento', /Editar lançamento/.test(lanc), lanc);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

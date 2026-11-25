// Pedido do Vitor em 25/11/2026: no Planejamento, tocar no valor gasto de
// uma categoria abre embaixo as subcategorias, e cada uma, os gastos; o gasto
// abre de onde veio.
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t194-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const L = (id, valor, sub, data, desc) => ({ id: m + id, tipo: 'saida', valor, descricao: desc, categoria: 'Moradia', subcategoria: sub, data, contaId: m + 'in' });
  const dados = { contas: [{ id: m + 'in', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 500000 }],
    lancamentos: [L('a', 150000, 'Aluguel', '2026-11-05', 'Aluguel novembro'), L('b', 45000, 'Condomínio', '2026-11-08', 'Condomínio Ed. Sol'),
                  L('c', 8161, 'Condomínio', '2026-11-20', 'Taxa extra condomínio')] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Planejar")'); await page.waitForTimeout(1200);
await page.click('#telaPlanejamento .cartao:has-text("Orçamento mensal") .cartao-acao'); await page.waitForTimeout(1000);
await page.click('#folha .cartao-acao:has-text("Escolher")'); await page.waitForTimeout(1000);
const linhaMoradia = page.locator('#folha .cat-bloco', { hasText: 'Moradia' });
const valor = limpo(await linhaMoradia.locator('.cat-gasto').textContent());
conferir('1. o valor gasto aparece com a setinha de abrir', /R\$ 2\.031,61\s*›/.test(valor), valor);
await linhaMoradia.locator('.cat-gasto').click(); await page.waitForTimeout(400);
const subs = (await page.locator('#folha .cat-detalhe:not([hidden]) > .comp-linha').allTextContents()).map(limpo);
conferir('2. tocando no valor, abrem as subcategorias com quantos gastos e o total', subs.length === 2 &&
  /Aluguel\s*1 gasto\s*R\$ 1\.500,00/.test(subs[0]) && /Condomínio\s*2 gastos\s*R\$ 531,61/.test(subs[1]), subs.join(' | '));
conferir('3. tocar no valor não marca a categoria', (await linhaMoradia.getAttribute('aria-pressed')) === 'false');
await page.locator('#folha .cat-detalhe .comp-linha', { hasText: 'Condomínio' }).first().click(); await page.waitForTimeout(400);
const gastos = (await page.locator('#folha .cat-detalhe .comp-gasto').allTextContents()).map(limpo);
conferir('4. a subcategoria abre os gastos, com data, conta e valor', gastos.length === 2 && /Condomínio Ed\. Sol\s*08\/11\/2026 · Banco Inter\s*lançamento\s*R\$ 450,00/.test(gastos[0]), gastos.join(' | '));
await page.locator('#folha .cat-detalhe').screenshot({ path: dir + '/z136-planejamento-detalhe.png' }).catch(() => {});
await page.locator('#folha .comp-gasto', { hasText: 'Condomínio Ed. Sol' }).click(); await page.waitForTimeout(1500);
const titulo = limpo(await page.textContent('#folhaTitulo').catch(() => ''));
conferir('5. o gasto abre o lançamento', /Editar lançamento/.test(titulo), titulo);
await page.goBack(); await page.waitForTimeout(1500);
conferir('6. voltando, cai de novo nas categorias', /Categorias/.test(limpo(await page.textContent('#folhaTitulo').catch(() => ''))));
await page.locator('#folha .cat-bloco', { hasText: 'Moradia' }).locator('.cat-toggle').click(); await page.waitForTimeout(400);
conferir('7. tocar no nome continua marcando a categoria', (await page.locator('#folha .cat-bloco', { hasText: 'Moradia' }).getAttribute('aria-pressed')) === 'true');

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

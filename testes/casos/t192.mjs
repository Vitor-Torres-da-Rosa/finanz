// Pedido do Vitor em 25/11/2026: em Investimentos, quadrados de renda fixa
// no topo que andam sozinhos — Selic, CDI e IPCA do Banco Central com o
// gráfico, a conta de CDB e LCI/LCA, e as ofertas que ele anotar — e os
// tipos de investimento para escolher (só renda fixa mostra algo por ora).
// O Banco Central é simulado aqui: o teste não sai para a internet.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const serie = (de, ate, n) => Array.from({ length: n }, (_, i) => {
  const d = new Date(2025, 10, 25 + Math.round(i * 365 / (n - 1)));
  return { data: String(d.getDate()).padStart(2, '0') + '/' + String(d.getMonth() + 1).padStart(2, '0') + '/' + d.getFullYear(),
           valor: (de + (ate - de) * i / (n - 1)).toFixed(2) };
});
const SERIES = { 432: serie(12.25, 15, 20), 4389: serie(12.15, 14.9, 20), 13522: serie(4.5, 4.68, 13) };
let bcFora = false;
await ctx.route('https://api.bcb.gov.br/**', (route) => {
  if (bcFora) return route.abort();
  const n = +(/sgs\.(\d+)/.exec(route.request().url()) || [])[1];
  route.fulfill({ status: 200, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(SERIES[n] || []) });
});
const page = await ctx.newPage();
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t192-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.click('#navegacao button:has-text("Investir")'); await page.waitForTimeout(2500);
const vit = page.locator('#telaInvestimentos .vitrine-rf');
const quadros = async () => (await vit.locator('.quadro-rf').allTextContents()).map(limpo);
let qs = await quadros();
console.log('quadros:', qs.join(' | '));
conferir('1. Selic, CDI e IPCA do Banco Central, com quanto mudaram em 12 meses e a linha',
  qs.some(q => /^SELIC\s*meta do Banco Central\s*15,00%\s*↑ 2,75 p\.p\. em 12 meses/i.test(q)) && qs.some(q => /^CDI.*14,90%/i.test(q)) && qs.some(q => /^IPCA.*4,68%/i.test(q)) &&
  (await vit.locator('.quadro-rf svg.q-linha polyline').count()) === 3, qs.slice(0, 3).join(' | '));
conferir('2. a conta do CDB e da LCI/LCA com o CDI de hoje', qs.some(q => /CDB\s*110% do CDI\s*13,93%\s*líquido ao ano \(bruto 16,39%, IR 15%\)/.test(q)) &&
  qs.some(q => /LCI \/ LCA\s*95% do CDI\s*14,16%\s*ao ano, sem imposto · igual a um CDB de 112% do CDI/.test(q)), qs.join(' | '));
conferir('3. diz de onde vem cada número', /Banco Central, atualizado em 25\/11\/2026/.test(limpo(await vit.locator('.vitrine-fonte').textContent())));
await vit.screenshot({ path: dir + '/z132-renda-fixa.png' });

// Anda sozinho.
const antesX = await vit.locator('.vitrine-trilho').evaluate(n => n.scrollLeft);
await page.waitForTimeout(4200);
const depoisX = await vit.locator('.vitrine-trilho').evaluate(n => n.scrollLeft);
conferir('4. os quadrados andam sozinhos', depoisX > antesX, antesX + ' → ' + depoisX);

// Anota duas ofertas.
const anotar = async (banco, tipo, indexador, taxa, vence) => {
  await page.click('#telaInvestimentos .cartao-acao:has-text("+ Anotar")'); await page.waitForTimeout(800);
  await page.fill('#folha .campo-banco-oferta', banco);
  await page.click('#folha .chip:text-is("' + tipo + '")');
  await page.click('#folha .segmentos button:has-text("' + indexador + '")');
  await page.fill('#folha .campo-taxa-oferta', taxa);
  if (vence) await page.locator('#folha input[type=date]').fill(vence);
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1200);
};
await anotar('Banco Master', 'LCA', '% do CDI', '98');
await anotar('XP', 'CDB', 'Prefixado', '16', '2027-11-25');
qs = await quadros();
const anotadas = qs.filter(q => /anotada/.test(q));
console.log('anotadas:', anotadas.join(' | '));
conferir('5. as ofertas anotadas viram quadrados, da que mais rende líquido para a que menos',
  anotadas.length === 2 && /^LCA\s*Banco Master\s*14,60%\s*98% do CDI · líquido ao ano/.test(anotadas[0]) && /^CDB\s*XP\s*13,20%\s*16,00% a\.a\. prefixado · líquido ao ano · vence 25\/11\/2027/.test(anotadas[1]),
  anotadas.join(' | '));
const lista = limpo(await page.textContent('#telaInvestimentos .cartao:has(.cartao-titulo:text-is("Ofertas anotadas"))'));
conferir('6. e aparecem na lista de ofertas anotadas', /LCA · Banco Master\s*98% do CDI\s*14,60% líq\./.test(lista) && /CDB · XP/.test(lista), lista.slice(0, 160));

// Tipos: só renda fixa mostra conteúdo.
await page.click('#telaInvestimentos .tipos-invest .chip:has-text("Cripto (Bitcoin)")'); await page.waitForTimeout(600);
const cripto = limpo(await page.textContent('#telaInvestimentos'));
conferir('7. os outros tipos já dá para escolher, mas ainda dizem "em breve"', /Cripto \(Bitcoin\) em breve/.test(cripto) && !/Ofertas anotadas/.test(cripto));
await page.click('#telaInvestimentos .tipos-invest .chip:has-text("Renda fixa")'); await page.waitForTimeout(600);

// As ofertas ficam guardadas na conta.
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3000);
await page.evaluate(() => { localStorage.removeItem('caixa.dados.v2'); });
await page.click('#navegacao button:has-text("Investir")').catch(() => {}); await page.waitForTimeout(1500);
const depois = (await quadros()).filter(q => /anotada/.test(q));
conferir('8. depois de abrir de novo, as ofertas continuam', depois.length === 2, depois.length);

// Sem o Banco Central: diz que não conseguiu, sem número inventado.
bcFora = true;
await page.evaluate(() => { localStorage.removeItem('finanz.taxasBC'); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Investir")').catch(() => {}); await page.waitForTimeout(2500);
const semBC = (await quadros()).join(' | ');
conferir('9. sem o Banco Central, avisa e não mostra taxa nenhuma', /Não consegui buscar as taxas agora/.test(semBC) && !/14,90%/.test(semBC) && !/CDB\s*110% do CDI/.test(semBC), semBC.slice(0, 200));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

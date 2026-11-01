// A linha de estimativa embaixo de Receitas, Despesas e Investido no Início.
//
// Pedido do Vitor em 01/11/2026: ela só aparecia a partir do dia 3 do
// mês, e tem de aparecer sempre. Projetar o ritmo no começo do mês
// multiplica o salário por 30; a base é o costume dos últimos meses, e o
// que já aconteceu é o piso.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const kpis = async () => page.$$eval('#telaInicio .kpi', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t138-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Conta nova: a linha existe nos três, mesmo sem nada lançado.
let k = await kpis();
console.log('sem dados:', k);
conferir('1. Receitas tem estimativa desde o primeiro dia', /Estimativa\s*R\$ 0,00/.test(k[0] || ''), k[0]);
conferir('2. Despesas também', /Estimativa\s*R\$ 0,00/.test(k[1] || ''), k[1]);
conferir('3. Investido mostra a rentabilidade, mesmo vazia', /Rentabilidade\s*—/.test(k[2] || ''), k[2]);

// Três meses de costume (R$ 5.000 entram, R$ 3.000 saem) e, neste mês,
// só R$ 500 de gasto até agora. Mais um investimento que rendeu 10%.
await page.evaluate(() => new Promise(res => {
  const hoje = new Date();
  const dia = (m, d) => { const x = new Date(hoje.getFullYear(), hoje.getMonth() - m, d);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const l = [];
  for (let m = 1; m <= 3; m++) {
    l.push({ id: 'e' + m, tipo: 'entrada', valor: 500000, data: dia(m, 12), contaId: 'cc', categoria: 'Salário', descricao: 'Salário' });
    l.push({ id: 's' + m, tipo: 'saida', valor: 300000, data: dia(m, 12), contaId: 'cc', categoria: 'Moradia', descricao: 'Aluguel' });
  }
  l.push({ id: 'hoje', tipo: 'saida', valor: 50000, data: dia(0, hoje.getDate()), contaId: 'cc', categoria: 'Mercado', descricao: 'Mercado' });
  const dados = { contas: [{ id: 'cc', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 }],
                  lancamentos: l,
                  ativos: [{ id: 'cdb', nome: 'CDB', classe: 'Renda fixa', aplicado: 100000,
                             historico: [{ data: dia(0, 1), valor: 110000 }] }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1200);

k = await kpis();
console.log('com costume:', k);
conferir('4. Receitas estima pelo costume, não pelo ritmo do dia', /Estimativa\s*R\$ 5\.000,00/.test(k[0] || ''), k[0]);
conferir('5. Despesas estima pelo costume', /Estimativa\s*R\$ 3\.000,00/.test(k[1] || ''), k[1]);
conferir('6. rentabilidade do que foi aplicado', /Rentabilidade\s*\+10,0%/.test(k[2] || ''), k[2]);
const direita = await page.$$eval('#telaInicio .kpi', ns => Math.max(...ns.map(n => n.getBoundingClientRect().right)));
conferir('7. os três cartões cabem na tela', direita <= 390, Math.round(direita) + 'px');
await page.screenshot({ path: dir + '/z23-estimativas.png' });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: a estimativa aparece sempre');

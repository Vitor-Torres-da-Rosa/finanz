// Saúde financeira em pontos que somam (pedido do Vitor em 17/11/2026):
// cada parte vale até um tanto de pontos, todas juntas valem 100, a parte
// sem dados fica com zero, e a soma da folha é a nota de cima.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.clock.setFixedTime(new Date(2026, 10, 17, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t174-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Três meses de histórico, sem cartão e sem investimento: duas partes
// ficam sem dados e têm de aparecer com zero.
await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const conta = m + '-cc', lanc = [];
  ['2026-06', '2026-07', '2026-08', '2026-09', '2026-10', '2026-11'].forEach((mes, k) => {
    lanc.push({ id: m + 'e' + k, tipo: 'entrada', valor: 500000, descricao: 'Salário', categoria: 'Salário', data: mes + '-05', contaId: conta });
    lanc.push({ id: m + 's' + k, tipo: 'saida', valor: k === 5 ? 250000 : 320000, descricao: 'Gastos', categoria: 'Mercado', data: mes + '-10', contaId: conta });
  });
  const dados = { contas: [{ id: conta, nome: 'C6', tipo: 'Conta corrente', saldoInicial: 0 }], lancamentos: lanc,
    metas: [{ id: m + 'm', nome: 'Viagem', alvo: 1000000, guardado: 100000 }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
const nota = Number(limpo(await page.textContent('.saude-valor').catch(() => '')));
await page.click('button:has-text("Como calculamos")'); await page.waitForTimeout(1000);
const partes = await page.$$eval('#folha .parte-nota:not(.parte-total)', ns => ns.map(n => ({
  nome: n.querySelector('.parte-topo span').textContent, pts: n.querySelector('.parte-pontos').textContent, sem: n.classList.contains('parte-sem-dados') })));
console.log('nota', nota, JSON.stringify(partes));
const nums = partes.map(p => { const m = p.pts.match(/(\d+) de (\d+)/); return m ? [+m[1], +m[2]] : [NaN, NaN]; });
const somaPts = nums.reduce((a, x) => a + x[0], 0), somaMax = nums.reduce((a, x) => a + x[1], 0);
const total = limpo(await page.textContent('#folha .parte-total').catch(() => ''));
conferir('1. as seis partes aparecem, e o máximo de todas soma 100', partes.length === 6 && somaMax === 100, partes.length + ' partes, máx ' + somaMax);
conferir('2. a soma dos pontos é a nota de cima, e o total diz isso', nota > 0 && somaPts === nota && new RegExp('Sua nota\\s*' + nota + ' de 100').test(total), somaPts + ' vs ' + nota + ' | ' + total);
const semDados = partes.filter(p => p.sem).map(p => p.nome + ' ' + p.pts);
conferir('3. sem cartão e sem investimento: essas partes ficam com zero', semDados.every(t => /^.* 0 de \d+$/.test(t)) &&
  /Peso do cartão/.test(semDados.join()) && /investido/.test(semDados.join()), semDados.join(' | '));
const pontosVisiveis = await page.$eval('#folha .parte-pontos', e => getComputedStyle(e).filter);
conferir('4. os pontos não são embaçados pelo olho (não é dinheiro)', pontosVisiveis === 'none', pontosVisiveis);
await page.screenshot({ path: dir + '/z100-saude-pontos.png' });
console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

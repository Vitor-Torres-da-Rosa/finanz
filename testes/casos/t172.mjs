// O valor no meio da rosca não pode passar por cima do anel (pedido do
// Vitor em 17/11/2026: "R$ 1.012.826,56" vazava). O furo tem ~110px numa
// caixa de 168px: o texto tem de ficar a pelo menos 29px de cada lado.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
await page.clock.setFixedTime(new Date(2026, 10, 17, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t172-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
let n = 0;
for (const [nome, v] of [['R$ 1.012.826,56', 101282656], ['R$ 99.999.999,99', 9999999999], ['R$ 45,90', 4590]]) {
  n++;
  await page.evaluate((v) => new Promise(res => {
    const dados = { contas: [{ id: 'c6', nome: 'C6', tipo: 'Conta corrente', saldoInicial: 0 }],
      lancamentos: [{ id: 'a', tipo: 'saida', valor: Math.round(v * .7), descricao: 'x', categoria: 'Financeiro', data: '2026-11-05', contaId: 'c6' },
                    { id: 'b', tipo: 'saida', valor: v - Math.round(v * .7), descricao: 'y', categoria: 'Moradia', data: '2026-11-06', contaId: 'c6' }] };
    const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
    const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
    inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
  }), v);
  await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(2500);
  await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(800);
  const m = await page.locator('#telaInicio .rosca-caixa').first().evaluate(cx => { const v = cx.querySelector('.rosca-centro .v'); const a = cx.getBoundingClientRect(), b = v.getBoundingClientRect();
    return { texto: v.textContent.replace(/\s/g, ' '), esq: Math.round(b.left - a.left), dir: Math.round(a.right - b.right), cheio: v.scrollWidth <= Math.ceil(b.width) + 1 }; });
  conferir(n + '. ' + nome + ' cabe dentro do furo da rosca, inteiro', m.texto === nome && m.esq >= 29 && m.dir >= 29 && m.cheio, JSON.stringify(m));
}
await page.locator('#telaInicio .rosca-caixa').first().screenshot({ path: dir + '/z99-rosca.png' });
console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

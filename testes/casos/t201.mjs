// Novidades no Início depois de atualizar (pedido do Vitor em 25/11/2026):
// o que mudou desde a última versão vista aparece no topo, até "Entendi".
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.goto(ENDERECO, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('finanz.privado', '0'); localStorage.setItem('finanz.novidades.teste', '1'); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t201-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3500);
conferir('1. conta nova não recebe o histórico de novidades', await page.locator('#telaInicio .cartao-novidades').count() === 0);

// quem já usava, vindo da 5.103.0
await page.evaluate(() => new Promise(res => {
  const m = 'x' + Math.random().toString(36).slice(2, 7);
  const dados = { contas: [{ id: m + 'c', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 10000 }],
    lancamentos: [{ id: m + 'l', tipo: 'saida', valor: 1000, descricao: 'Mercado', categoria: 'Alimentação', data: '2026-11-20', contaId: m + 'c' }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(4000);
await page.evaluate(() => localStorage.setItem('finanz.versaoVista', '5.103.0'));
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(4000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(800);
const card = limpo(await page.textContent('#telaInicio .cartao-novidades').catch(() => ''));
const primeiro = await page.evaluate(() => { const k = document.querySelector('#telaInicio .cartao'); return k && k.classList.contains('cartao-novidades'); });
conferir('2. depois de atualizar, as novidades aparecem no topo do Início, desde a versão vista', primeiro && /Novidades da versão \d+\.\d+\.\d+/.test(card) &&
  /3 versões desde a última vez/.test(card) && /Ver tudo/.test(card), card.slice(0, 200));
await page.screenshot({ path: dir + '/z201-novidades.png' });
await page.click('#telaInicio .cartao-novidades button:has-text("Ver tudo")'); await page.waitForTimeout(800);
conferir('3. "Ver tudo" abre o histórico das versões', /Histórico das versões/.test(limpo(await page.textContent('#folha'))));
await page.goBack(); await page.waitForTimeout(700);
await page.click('#telaInicio .botao-novidades-ok'); await page.waitForTimeout(600);
conferir('4. "Entendi" fecha', await page.locator('#telaInicio .cartao-novidades').count() === 0);
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3000);
conferir('5. e não volta até a próxima atualização', await page.locator('#telaInicio .cartao-novidades').count() === 0);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

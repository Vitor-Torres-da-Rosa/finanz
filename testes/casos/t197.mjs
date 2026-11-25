// A seta da abertura (pedido do Vitor em 25/11/2026): uma seta sutil, com
// movimento, diz que tem mais embaixo. Tocar nela desce; descendo, ela some.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
await page.goto(ENDERECO, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1600);
const seta = page.locator('#entrada .ent-seta');
const info = await seta.evaluate(n => ({ classe: n.className, anim: getComputedStyle(n).animationName, op: getComputedStyle(n).opacity }));
conferir('1. na abertura aparece a seta, com movimento', /ent-seta/.test(info.classe) && !/sumiu/.test(info.classe) && info.anim === 'ent-seta-anda', JSON.stringify(info));
await page.screenshot({ path: dir + '/z197-seta-abertura.png' });
await seta.click(); await page.waitForTimeout(1000);
const topo = await page.evaluate(() => document.getElementById('entrada').scrollTop);
conferir('2. tocar na seta desce a tela e a seta some', topo > 100 && /sumiu/.test(await seta.getAttribute('class')), topo);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 0; }); await page.waitForTimeout(400);
conferir('3. voltando ao topo, ela volta', !/sumiu/.test(await seta.getAttribute('class')));
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; }); await page.waitForTimeout(300);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(600);
conferir('4. no cadastro não tem seta', await page.locator('#entrada .ent-seta').count() === 0);
console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

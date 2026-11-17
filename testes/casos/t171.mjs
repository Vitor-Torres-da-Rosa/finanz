// Olho da privacidade (pedido do Vitor em 17/11/2026): os valores começam
// escondidos sempre que o app abre, e o olho no topo mostra e esconde.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const filtro = (sel) => page.evaluate((s) => { const e = document.querySelector(s); return e ? getComputedStyle(e).filter : '(sem elemento)'; }, sel);

await page.clock.setFixedTime(new Date(2026, 10, 17, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t171-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

const valor = '#telaInicio .heroi-valor';
conferir('1. abrindo o app, os valores já vêm escondidos', /blur/.test(await filtro(valor)) &&
  (await page.getAttribute('#telaInicio .marca-olho', 'aria-label')) === 'Mostrar os valores', await filtro(valor));
await page.screenshot({ path: dir + '/z97-privacidade-ligada.png', clip: { x: 0, y: 0, width: 390, height: 600 } });
await page.click('#telaInicio .marca-olho'); await page.waitForTimeout(500);
conferir('2. tocando no olho, os valores aparecem', (await filtro(valor)) === 'none' &&
  (await page.getAttribute('#telaInicio .marca-olho', 'aria-label')) === 'Esconder os valores', await filtro(valor));
await page.screenshot({ path: dir + '/z98-privacidade-desligada.png', clip: { x: 0, y: 0, width: 390, height: 600 } });
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(800);
const naLista = await page.evaluate(() => { const e = document.querySelector('#telaTransacoes .linha-valor, #telaTransacoes .v'); return e ? getComputedStyle(e).filter : 'none'; });
conferir('3. mostrando, vale para as outras telas também', naLista === 'none', naLista);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(800);
await page.click('#telaInicio .marca-olho'); await page.waitForTimeout(400);
conferir('4. tocando de novo, esconde', /blur/.test(await filtro(valor)));
await page.click('#telaInicio .marca-olho'); await page.waitForTimeout(400);
// Atualizar a página mantém o que a pessoa deixou (pedido de 17/11/2026).
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(3000);
conferir('5. atualizando a página, continua como ela deixou (mostrando)', (await filtro(valor)) === 'none', await filtro(valor));
// Fechar e abrir o app é uma aba nova: o sessionStorage começa vazio.
const outra = await page.context().newPage();
await outra.goto(ENDERECO, { waitUntil:'networkidle' }); await outra.waitForTimeout(3000);
const filtroNova = await outra.evaluate(() => { const e = document.querySelector('#telaInicio .heroi-valor'); return e ? getComputedStyle(e).filter : '(sem elemento)'; });
conferir('6. fechou e abriu: volta escondido', /blur/.test(filtroNova), filtroNova);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

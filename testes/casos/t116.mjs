// As explicações do app não podem ser cortadas no meio da frase.
//
// Achado em 24/10/2026, tirando print da folha de "Voltar a uma data": o
// parágrafo que explica a folha aparecia como "O app guarda na nuvem uma
// cópia inteira dos seus dados se…" e parava ali. A classe .linha-sub é
// de uma linha só com reticências — certo para o subtítulo ao lado de um
// valor numa lista, que quebrando desalinharia tudo. Só que o app usa a
// mesma classe nos parágrafos que explicam cada folha, e lá o corte comia
// a frase: 21 explicações pelo app, nenhuma legível até o fim.
//
// Este teste abre várias folhas e confere que nenhum parágrafo está
// cortado — largura rolável maior que a largura visível é corte.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const irParaInicio = async () => {
  for (let i = 0; i < 8; i++) {
    if (await page.locator('#telaInicio:visible').count()) return;
    await page.locator('#navegacao button').nth(1).click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    await page.locator('#navegacao button').nth(0).click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }
};

// Devolve os parágrafos cortados que estiverem na tela agora.
//
// A folha fechada continua no DOM, só deslizada para fora por transform —
// e transform não zera offsetParent. Sem descartar o que está dentro de
// uma folha fechada, o parágrafo da folha anterior aparecia em todas as
// verificações seguintes e eu não saberia de qual tela era a queixa.
const cortados = async () => page.evaluate(() => {
  const fora = [];
  document.querySelectorAll('p.linha-sub').forEach((p) => {
    if (!p.offsetParent) return;                       // escondido, não conta
    const f = p.closest('.folha');
    if (f && !f.classList.contains('aberta')) return;  // folha fechada
    if (p.scrollWidth > p.clientWidth + 1) fora.push((p.textContent || '').slice(0, 70));
  });
  return fora;
});

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t116-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// A folha onde o defeito apareceu, e a frase inteira que tem que caber.
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1000);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
const presos = await cortados();
conferir('1. a explicação de "Voltar a uma data" aparece inteira',
  presos.length === 0, JSON.stringify(presos));
const alturas = await page.evaluate(() => {
  const p = document.querySelector('#folha p.linha-sub');
  return p ? { linhas: Math.round(p.clientHeight / parseFloat(getComputedStyle(p).lineHeight)),
               fim: (p.textContent || '').slice(-30) } : null;
});
conferir('2. e ocupa mais de uma linha, como um parágrafo', alturas && alturas.linhas >= 2,
  JSON.stringify(alturas));
await page.screenshot({ path: dir+'/z05-explicacao-inteira.png', fullPage: true });

// Fecho a folha antes de varrer o resto: com ela aberta, o parágrafo dela
// continuaria no DOM e apareceria em toda verificação seguinte.
await page.click('#cortina', { force: true }).catch(() => {}); await page.waitForTimeout(900);

// O resto do app: as cinco telas. Qualquer parágrafo cortado acusa, e a
// tela de Planejar sozinha tinha três.
for (const aba of ['Início', 'Transações', 'Investir', 'Planejar', 'Mais']) {
  await page.click('#navegacao button:has-text("' + aba + '")'); await page.waitForTimeout(1400);
  const p = await cortados();
  conferir('3. tela ' + aba + ': explicação inteira', p.length === 0, JSON.stringify(p));
}

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: nenhuma explicação cortada');

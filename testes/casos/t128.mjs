// Duas abas na mesma conta, e a porta que as versões guardadas abriam.
//
// Em 25/10/2026 os números do Vitor passaram a tarde mudando sozinhos. O
// Histórico do saldo acusou: "Veio da nuvem · 1000 lanç. · 4 contas",
// sem ele ter mexido em nada.
//
// A porta era a página de versões. Cada pasta em versoes/ é um app
// INTEIRO, na mesma origem, apontando para o mesmo servidor — e até a
// 5.18.0 ela abria numa aba nova. A aba ficou aberta, leu a sessão
// guardada no aparelho, e virou um segundo Finanz logado na mesma conta.
// Dois mandando versões diferentes, cada um desfazendo o outro.
//
// Dois consertos, os dois aqui: o app avisa quando outra aba mexe no mesmo
// cofre, e a sessão mudou de chave para a versão guardada não achar
// sessão nenhuma e abrir desconectada.
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
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const porDinheiro = async (loc, d) => {
  await loc.click();
  for (let i = 0; i < 16; i++) await loc.press('Backspace');
  await loc.type(d);
  await page.waitForTimeout(300);
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
const totalEmContas = async () => {
  await irParaInicio(); await page.waitForTimeout(800);
  const t = limpo(await page.textContent('#telaInicio').catch(() => ''));
  const m = t.match(/Total em contas\s*(−?-?R\$ [\d.,]+)/);
  return m ? m[1].replace('−', '-') : '(não achei)';
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t128-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await irParaInicio();
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1300);
await page.click('#fab'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '32000');
await folha().locator('input.entrada[type=text]').first().fill('Aluguel');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(5000);

const chaves = await page.evaluate(() => ({
  nova: !!localStorage.getItem('caixa.nuvem.v4'),
  velha: !!localStorage.getItem('caixa.nuvem.v3')
}));
conferir('1. a sessão fica na chave nova, e a antiga não existe',
  chaves.nova && !chaves.velha, JSON.stringify(chaves));

// ---- outra aba mexendo no mesmo cofre ----
//
// Uma segunda página do MESMO contexto é outra aba de verdade: gravar no
// localStorage dela dispara o evento `storage` nesta. É o que acontece
// quando uma versão guardada fica aberta do lado.
const outra = await ctx.newPage();
await outra.goto(ENDERECO, { waitUntil:'domcontentloaded' });
await outra.evaluate(() => {
  const chave = Object.keys(localStorage).filter((k) => k.indexOf('caixa.cofre.') === 0)[0];
  if (!chave) return;
  // Gravar o MESMO valor não dispara evento nenhum: o navegador só avisa
  // quando o conteúdo muda de verdade. Então mudo e devolvo na sequência —
  // o evento sai, e o cofre fica como estava.
  const antes = localStorage.getItem(chave);
  localStorage.setItem(chave, antes + ' ');
  localStorage.setItem(chave, antes);
});
await page.waitForTimeout(2500);
const aviso = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
const texto = limpo(await page.textContent('#dialogoTexto').catch(() => ''));
console.log('aviso:', aviso, '|', texto.slice(0, 160));
conferir('2. o app avisa que tem outro Finanz aberto na mesma conta',
  /outro Finanz aberto/.test(aviso), aviso);
conferir('3. e diz o que fazer, inclusive sobre a versão guardada',
  /Feche as outras/.test(texto) && /versão guardada/.test(texto), texto.slice(0, 180));
await page.screenshot({ path: dir+'/z28-outra-aba.png' });
await outra.close();
const bs = page.locator('#dialogoAcoes button');
if (await bs.count()) { await bs.first().click(); await page.waitForTimeout(900); }

// ---- quem já estava logado na chave antiga não pode ser deslogado ----
await page.evaluate(() => {
  var v = localStorage.getItem('caixa.nuvem.v4');
  localStorage.setItem('caixa.nuvem.v3', v);
  localStorage.removeItem('caixa.nuvem.v4');
});
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(12000);
conferir('4. abrindo com a sessão na chave antiga, continua logado',
  (await totalEmContas()) === '-R$ 320,00', await totalEmContas());
const depois = await page.evaluate(() => ({
  nova: !!localStorage.getItem('caixa.nuvem.v4'),
  velha: !!localStorage.getItem('caixa.nuvem.v3')
}));
conferir('5. e a sessão passou para a chave nova, fechando a porta',
  depois.nova && !depois.velha, JSON.stringify(depois));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: duas abas são avisadas, e a versão guardada não herda mais a sessão');

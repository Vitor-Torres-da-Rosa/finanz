// Se não der para salvar antes de atualizar, a pessoa tem que saber.
//
// Pedido do Vitor em 24/10/2026: "se der falha mostrar também, a pessoa
// não pode correr o risco de perder os dados".
//
// Até a 5.16.1 o app guardava a cópia em silêncio, esperava seis segundos
// e trocava de versão mesmo tendo falhado. Falhar calado bem na hora em
// que a pessoa está esperando é o pior jeito de falhar.
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
await c.nth(1).fill('t121-' + Date.now() + '-' + process.pid + '@exemplo.com');
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
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);

// Versão nova à vista, e o servidor fora do ar na hora errada.
await ctx.addCookies([{ name:'swversao', value:'99.0.0-teste', domain:'127.0.0.1', path:'/' }]);
await ctx.route('**/rest/v1/**', (r) => r.abort());
await page.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  if (r) await r.update().catch(() => {});
});
await page.locator('#avisoVersao').waitFor({ state:'visible', timeout: 30000 }).catch(() => {});
conferir('1. o aviso de versão nova apareceu', (await page.locator('#avisoVersao').count()) === 1);

await page.click('#avisoVersao button'); await page.waitForTimeout(1200);
conferir('2. o app pergunta antes de atualizar',
  /Salvar na nuvem antes/.test(limpo(await page.textContent('#dialogoTitulo').catch(() => ''))),
  limpo(await page.textContent('#dialogoTitulo').catch(() => '')));

// Sem a pergunta não há o que clicar — e aí o que interessa é o relatório
// inteiro das verificações seguintes, não um timeout no meio.
if (await page.locator('#dialogoAcoes button:has-text("Salvar e atualizar")').count()) {
  await page.click('#dialogoAcoes button:has-text("Salvar e atualizar")');
  await page.waitForSelector('#dialogoTitulo:text-is("Não consegui salvar")', { timeout: 60000 })
    .catch(() => {});
}
const titulo = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
const texto = limpo(await page.textContent('#dialogoTexto').catch(() => ''));
const botoes = limpo(await page.textContent('#dialogoAcoes').catch(() => ''));
console.log('caixa de falha:', titulo, '|', texto.slice(0, 200), '|', botoes);
conferir('3. a falha aparece, não some em silêncio', /Não consegui salvar/.test(titulo), titulo);
conferir('4. e diz o motivo', /servidor|internet/i.test(texto), texto.slice(0, 120));
conferir('5. com as duas saídas: esperar ou atualizar assim mesmo',
  /Atualizar assim mesmo/.test(botoes) && /Esperar/.test(botoes), botoes);
await page.screenshot({ path: dir+'/z16-falha-antes-de-atualizar.png' });

// Escolhendo esperar, nada acontece: a versão não troca e o aviso volta
// ao normal, pronto para quando a conexão melhorar.
if (await page.locator('#dialogoAcoes button:has-text("Esperar")').count())
  await page.click('#dialogoAcoes button:has-text("Esperar")');
await page.waitForTimeout(2500);
const aviso = limpo(await page.textContent('#avisoVersao').catch(() => '(sumiu)'));
conferir('6. escolhendo esperar, o aviso volta ao normal e nada é atualizado',
  /Atualizar/.test(aviso) && !/Atualizando/.test(aviso), aviso);
const botaoVivo = await page.evaluate(() => {
  const b = document.querySelector('#avisoVersao button');
  return b ? !b.disabled : false;
});
conferir('7. e dá para tentar de novo', botaoVivo, String(botaoVivo));

// E os dados continuam aqui, que é o que a pessoa não pode perder.
await ctx.unroute('**/rest/v1/**');
conferir('8. os dados seguem no aparelho', (await totalEmContas()) === '-R$ 320,00',
  await totalEmContas());

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: a falha antes de atualizar aparece, com saída para os dois lados');

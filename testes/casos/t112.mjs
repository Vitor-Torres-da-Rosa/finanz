// O que nasce durante a sincronização não pode ser engolido por ela.
//
// A sincronização lê o estado no começo, manda para a nuvem, baixa o que
// o servidor tem e faz `estado = doServidor`. Entre o envio e a volta
// passam alguns segundos — e tudo o que a pessoa criar nesse intervalo
// não estava no envio, então volta inexistente e some da tela e do
// aparelho.
//
// Apareceu como "conta criada pela importação não aparece no Início":
// o app cria a conta do banco, lança o extrato, e a conta sumia. Mas o
// defeito não é da importação; é de qualquer coisa criada na hora errada.
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
const novaConta = async (nome) => {
  await irParaInicio();
  await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
  await folha().locator('input.entrada[type=text]').first().fill(nome);
  await page.click('#folha .btn-ouro'); await page.waitForTimeout(1400);
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t112-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await novaConta('Banco Inter');
await page.click('#fab'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '32000');
await folha().locator('input.entrada[type=text]').first().fill('Aluguel');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1600);
await page.waitForTimeout(7000);
conferir('1. a conta e o lançamento estão lá',
  /Banco Inter/.test(limpo(await page.textContent('#telaInicio'))));

// ---- segura a VOLTA da sincronização e cria uma conta no meio ----
//
// Os GETs são a volta; o envio é POST/PATCH e passa normal. Segurando só
// os GETs, eu abro exatamente a janela entre "mandou" e "recebeu".
let segurando = true;
await page.route('**/rest/v1/**', async (rota) => {
  if (rota.request().method() !== 'GET' || !segurando) return rota.continue();
  await new Promise((r) => setTimeout(r, 9000));
  return rota.continue();
});

// Uma edição qualquer agenda a sincronização (4s depois de salvar).
await page.click('#fab'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '1000');
await folha().locator('input.entrada[type=text]').first().fill('Café');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(5500);

// Agora o envio já foi e a volta está presa. Crio a conta AQUI.
console.log('criando a conta no meio da sincronização...');
await novaConta('C6 Bank');
conferir('2. a conta nova aparece na hora', /C6 Bank/.test(limpo(await page.textContent('#telaInicio'))));
await page.screenshot({ path: dir+'/w01-criada-no-meio.png', fullPage: true });

// Solta a volta e espera a sincronização terminar.
segurando = false;
await page.waitForTimeout(14000);
await irParaInicio(); await page.waitForTimeout(900);
const depois = limpo(await page.textContent('#telaInicio'));
console.log('depois da sincronização:', depois.replace(/^[\s\S]*Contas/, 'Contas').slice(0, 160));
conferir('3. e CONTINUA lá depois que a sincronização voltou',
  /C6 Bank/.test(depois), depois.replace(/^[\s\S]*Contas/, 'Contas').slice(0, 140));
conferir('4. sem levar a outra junto', /Banco Inter/.test(depois));
await page.screenshot({ path: dir+'/w02-depois-da-volta.png', fullPage: true });

// E tem de ter chegado na nuvem, não só sobrado na tela.
await page.unroute('**/rest/v1/**');
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(9000);
await irParaInicio(); await page.waitForTimeout(900);
const naNuvem = limpo(await page.textContent('#telaInicio'));
conferir('5. recarregando, a nuvem também tem as duas',
  /C6 Bank/.test(naNuvem) && /Banco Inter/.test(naNuvem),
  naNuvem.replace(/^[\s\S]*Contas/, 'Contas').slice(0, 140));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: o que nasce durante a sincronização sobrevive a ela');

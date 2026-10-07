// Servidor fora do ar não pode tirar a pessoa de dentro do app.
//
// O cofre é deste aparelho e não depende do servidor para abrir. Antes,
// qualquer falha de rede no arranque caía no catch que apagava a sessão e
// mandava para a tela de login — bem na hora em que o login também não
// funciona. Com o projeto pausado, quem tinha conta na nuvem ficava sem o
// app e sem os próprios dados.
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
const folhaFechou = () => page.waitForFunction(
  () => !document.getElementById('folha').classList.contains('aberta'), null, { timeout: 20000 });
const naEntrada = () => page.evaluate(() =>
  !document.getElementById('entrada').classList.contains('escondida'));

// --- conta criada e um lançamento dentro, com o servidor de pé ---
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t97'+Date.now()+'-'+process.pid+'@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.click('#fab'); await page.waitForTimeout(1000);
await page.locator('#folha input[inputmode=numeric]').first().fill('12345');
await page.locator('#folha input.entrada[type=text]').first().fill('Marco do teste');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await folhaFechou(); await page.waitForTimeout(2500);
conferir('1. com o servidor de pé, o app abre e guarda o lançamento',
  !(await naEntrada()) && /Marco do teste|R\$ 123,45/.test(limpo(await page.textContent('#telaInicio'))));

// --- servidor sumiu: o app tem de abrir assim mesmo, com os dados ---
await page.route('**/auth/v1/user*', (rota) => rota.abort('failed'));
await page.route('**/rest/v1/**', (rota) => rota.abort('failed'));
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(3500);
const telaSemServidor = limpo(await page.textContent('body'));
console.log('sem servidor:', telaSemServidor.slice(0, 200));
conferir('2. sem servidor, o app NÃO joga a pessoa na tela de login',
  !(await naEntrada()), (await naEntrada()) ? 'caiu na entrada' : 'abriu normal');
conferir('3. e os dados deste aparelho continuam lá',
  /123,45/.test(limpo(await page.textContent('#telaInicio'))),
  limpo(await page.textContent('#telaInicio')).slice(0, 110));
conferir('4. e ele avisa que não falou com o servidor',
  /Sem falar com o servidor/.test(telaSemServidor), telaSemServidor.slice(0, 120));
await page.screenshot({ path: dir+'/h01-sem-servidor.png', fullPage: true });

// --- a sessão tem de continuar guardada, para voltar sozinha ---
const aindaTemSessao = await page.evaluate(() => {
  for (var i = 0; i < localStorage.length; i++) {
    if (/sessao|sessão|nuvem/i.test(localStorage.key(i))) return true;
  }
  return false;
});
conferir('5. a sessão da nuvem não foi apagada por causa da rede', aindaTemSessao);

// --- token recusado de verdade: aí sim é para sair ---
await page.unroute('**/auth/v1/user*');
await page.route('**/auth/v1/user*', (rota) =>
  rota.fulfill({ status: 401, contentType: 'application/json',
                 body: JSON.stringify({ message: 'invalid claim: missing sub claim' }) }));
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(3500);
conferir('6. com o token recusado, aí sim ele volta para a entrada', await naEntrada());
await page.screenshot({ path: dir+'/h02-token-recusado.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: servidor fora do ar não derruba a sessão');

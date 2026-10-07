// A porta de trás: abrir os dados deste aparelho sem servidor nenhum.
//
// Até a 5.9.3, falha de rede no arranque apagava a sessão da nuvem. Quem
// abriu o app com o servidor pausado ficou sem token — e sem token a tela
// de entrada só oferecia login, que também não funciona com o servidor
// fora. Os dados estavam guardados e cifrados aqui o tempo todo, sem
// porta. Este teste é essa porta.
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

// --- conta da nuvem com dados dentro ---
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t98'+Date.now()+'-'+process.pid+'@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.click('#fab'); await page.waitForTimeout(1000);
await page.locator('#folha input[inputmode=numeric]').first().fill('54321');
await page.locator('#folha input.entrada[type=text]').first().fill('Tesouro guardado');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await folhaFechou(); await page.waitForTimeout(2500);
conferir('1. os dados entraram com o servidor de pé',
  /543,21/.test(limpo(await page.textContent('#telaInicio'))));

// --- o estrago do bug antigo: a sessão apagada, servidor fora ---
await page.evaluate(() => { localStorage.removeItem('caixa.nuvem.v3'); });
await page.route('**/auth/v1/**', (rota) => rota.abort('failed'));
await page.route('**/rest/v1/**', (rota) => rota.abort('failed'));
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(3000);
conferir('2. sem sessão e sem servidor, ele cai na tela de entrada', await naEntrada());

const entrada = limpo(await page.textContent('#entrada'));
console.log('entrada:', entrada.slice(-300));
conferir('3. mas agora a entrada oferece abrir os dados deste aparelho',
  /Abrir os dados deste aparelho/.test(entrada), entrada.slice(-180));
conferir('4. e explica o que é, sem prometer servidor',
  /guardados e cifrados neste aparelho/.test(entrada));
await page.screenshot({ path: dir+'/i01-porta-local.png', fullPage: true });

// --- a porta abre de verdade ---
await page.click('#entrada button:has-text("Abrir os dados deste aparelho")');
await page.waitForTimeout(2500);
conferir('5. ela abre o app', !(await naEntrada()));
const dentro = limpo(await page.textContent('#telaInicio'));
console.log('dentro:', dentro.slice(0, 140));
conferir('6. com os dados que estavam guardados', /543,21/.test(dentro), dentro.slice(0, 120));

// --- e dá para tirar o backup, que é o ponto ---
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1600);
const mais = limpo(await page.textContent('#telaMais'));
conferir('7. o backup em JSON está ao alcance', /Fazer backup/.test(mais));
const baixou = page.waitForEvent('download', { timeout: 20000 });
await page.click('#telaMais .linha:has-text("Fazer backup")');
const arquivo = await baixou;
console.log('arquivo:', arquivo.suggestedFilename());
conferir('8. e o arquivo sai mesmo', /finanz-backup-.*\.json/.test(arquivo.suggestedFilename()),
  arquivo.suggestedFilename());
await page.screenshot({ path: dir+'/i02-backup.png', fullPage: true });

// --- sem cofre guardado, a porta não aparece prometendo nada ---
const limpa = await ctx.newPage();
await limpa.goto(ENDERECO, { waitUntil:'networkidle' }); await limpa.waitForTimeout(400);
await limpa.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await limpa.reload({ waitUntil:'networkidle' }); await limpa.waitForTimeout(2500);
await limpa.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await limpa.waitForTimeout(800);
conferir('9. em aparelho sem dados, a porta não aparece',
  !/Abrir os dados deste aparelho/.test(limpo(await limpa.textContent('#entrada'))));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: dá para entrar nos próprios dados sem servidor');

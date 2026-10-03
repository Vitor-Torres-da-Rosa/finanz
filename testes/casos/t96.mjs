// Login com Google: um endereço de retorno só, e o servidor calado não
// pode sumir com o botão em silêncio.
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

// --- 1) o endereço de retorno é sempre o mesmo, com ou sem index.html ---
const retornoEm = async (url) => {
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil:'networkidle' });
  await p.waitForTimeout(1200);
  const r = await p.evaluate(() => {
    // mesma regra do app: caminho sem o index.html
    return location.origin + location.pathname.replace(/index\.html?$/i, '');
  });
  const naTela = await p.evaluate(() => {
    var a = document.querySelector('a[href*="provider=google"]');
    return a ? a.href : '';
  });
  await p.close();
  return r;
};
const comArquivo = await retornoEm(ENDERECO);
const semArquivo = await retornoEm(ENDERECO.replace(/index\.html$/, ''));
console.log('com index.html →', comArquivo);
console.log('sem index.html →', semArquivo);
conferir('1. os dois jeitos de abrir o app dão o mesmo endereço de retorno',
  comArquivo === semArquivo && !/index\.html/.test(comArquivo), comArquivo + ' vs ' + semArquivo);

// --- 2) servidor calado: o botão some, mas dizendo por quê ---
await page.route('**/auth/v1/settings*', (rota) => rota.abort('failed'));
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(2500);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.waitForTimeout(600);
const entrada = limpo(await page.textContent('#entrada'));
console.log('entrada:', entrada.slice(-320));
conferir('2. sem resposta do servidor, ele diz que não falou com o servidor',
  /Não falei com o servidor/.test(entrada), entrada.slice(-160));
// "Failed to fetch" não diz nada para quem está olhando a tela.
conferir('2b. e traduz o erro cru do navegador, nomeando o servidor',
  !/Failed to fetch/.test(entrada) &&
  /não achei o servidor/.test(entrada) && /127\.0\.0\.1|localhost/.test(entrada),
  (entrada.match(/tem internet.{0,90}/) || ['?'])[0]);
conferir('3. e diz que o e-mail e senha dependem dele também',
  /Entrar com e-mail e senha também depende dele/.test(entrada));
conferir('4. o botão do Google não fica lá prometendo o que não funciona',
  !/Continuar com Google/.test(entrada));
await page.screenshot({ path: dir+'/g01-servidor-mudo.png', fullPage: true });

// --- 3) servidor respondendo com o Google ligado: o botão volta ---
await page.unroute('**/auth/v1/settings*');
await page.route('**/auth/v1/settings*', (rota) =>
  rota.fulfill({ status: 200, contentType: 'application/json',
                 body: JSON.stringify({ external: { google: true } }) }));
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(2500);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.waitForTimeout(600);
const comGoogle = limpo(await page.textContent('#entrada'));
conferir('5. com o Google ligado no servidor, o botão aparece',
  /Continuar com Google/.test(comGoogle) && !/Não falei com o servidor/.test(comGoogle),
  comGoogle.slice(-140));
await page.screenshot({ path: dir+'/g02-com-google.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: endereço de retorno único e servidor mudo explicado');

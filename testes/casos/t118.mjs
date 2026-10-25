// Duas renovações de token ao mesmo tempo matariam a sessão.
//
// O refresh_token do Supabase roda: cada renovação devolve um novo e
// queima o anterior. Enquanto a sincronização era a única dona de pedidos
// à nuvem isso não dava problema — ela é sequencial. Com a cópia a cada
// alteração passou a haver dois relógios independentes, e nada impedia os
// dois de renovarem com o mesmo token em punho. Quem chegasse em segundo
// levaria "Invalid Refresh Token: Already Used", e a sessão guardada
// ficaria com um token queimado: dali em diante toda sincronização falha
// até a pessoa entrar de novo.
//
// Para o encontro acontecer sempre, e não quando o relógio ajudar:
//   · conta "curto-": o emulador dá token de 60s, e o app renova quando
//     falta MENOS de 60 — ou seja, todo pedido desta conta renova antes;
//   · a renovação fica 9 segundos pendurada, então quem chegar depois
//     dentro desses 9 segundos encontra a primeira ainda no ar;
//   · cookie esperainstantaneo=6000: a cópia por alteração sai 6 segundos
//     depois da mexida, e a sincronização sai aos 4. Uma cai dentro da
//     outra.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
await ctx.addCookies([{ name:'esperainstantaneo', value:'6000', domain:'127.0.0.1', path:'/' }]);
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
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

// Cada renovação vira um intervalo. Duas que se cruzam no tempo são o
// defeito: é quando as duas partem com o mesmo token na mão.
const renovacoes = [];
let t0 = Date.now();
await ctx.route(
  (url) => url.pathname === '/auth/v1/token' && url.searchParams.get('grant_type') === 'refresh_token',
  async (rota) => {
    const r = { inicio: Date.now() - t0, fim: 0 };
    renovacoes.push(r);
    await new Promise((f) => setTimeout(f, 9000));
    await rota.continue();
    r.fim = Date.now() - t0;
  });

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('curto-t118-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(4000);

await irParaInicio();
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1500);

// Deixo a poeira baixar e zero a contagem: o que interessa é a mexida
// abaixo, com os dois relógios armados ao mesmo tempo.
await page.waitForTimeout(16000);
renovacoes.length = 0; t0 = Date.now();

await page.click('#fab'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '32000');
await folha().locator('input.entrada[type=text]').first().fill('Aluguel');
await page.click('#folha .btn-ouro:has-text("Salvar")');
// Sincronização aos 4s, cópia por alteração aos 6s, renovação pendurada
// por 9s: a segunda nasce com a primeira ainda no ar.
await page.waitForTimeout(32000);

console.log('renovações:', JSON.stringify(renovacoes));
let cruzaram = null;
for (let i = 0; i < renovacoes.length && !cruzaram; i++) {
  for (let j = i + 1; j < renovacoes.length; j++) {
    const a = renovacoes[i], b = renovacoes[j];
    const fimA = a.fim || Infinity, fimB = b.fim || Infinity;
    if (a.inicio < fimB && b.inicio < fimA) { cruzaram = [a, b]; break; }
  }
}
conferir('1. houve renovação neste trecho (senão o teste não prova nada)',
  renovacoes.length >= 1, String(renovacoes.length));
conferir('2. nenhuma renovação começou com outra ainda no ar',
  !cruzaram, cruzaram ? JSON.stringify(cruzaram) : 'nenhuma se cruzou');

// A consequência: a sessão continua servindo e a mexida chega ao servidor.
//
// ATENÇÃO: esta verificação passa COM e SEM a trava. Sem ela as duas
// renovações se cruzam, mas o estrago é intermitente — depende de qual
// pedido levou o token queimado. Quem pega o defeito é a 2; esta aqui fica
// porque é a consequência que importa, e no dia em que ela cair junto já
// não será mais intermitente.
await page.waitForTimeout(14000);
const noServidor = await page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/lancamentos?select=descricao&excluido_em=is.null', {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
  const j = await r.json();
  return Array.isArray(j) ? j.map((l) => l.descricao) : ('erro ' + r.status);
});
conferir('3. e o lançamento chegou ao servidor', JSON.stringify(noServidor) === '["Aluguel"]',
  JSON.stringify(noServidor));
await page.screenshot({ path: dir+'/z08-renovacao-unica.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: uma renovação de cada vez, e a sessão sobrevive');

// A escolha de cofre offline não pode oferecer cofre vazio.
//
// Trocar de projeto no servidor cria conta nova, e conta nova abre um
// cofre vazio neste aparelho ao lado do antigo. Em 14/10/2026 o Vitor
// abriu a porta de trás e viu três opções: uma com 3520 lançamentos e
// duas com zero. Escolher uma das vazias dá a impressão de que os dados
// sumiram — e não havia nada na tela que dissesse qual era qual.
//
// Aqui a gente faz exatamente isso: três contas no mesmo aparelho, só a
// primeira com dados. A porta tem de abrir direto na cheia, sem perguntar.
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
const selo = Date.now() + '-' + process.pid;

async function criarConta(nome, email) {
  await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(600);
  const c = page.locator('.ent-campo input');
  await c.nth(0).fill(nome); await c.nth(1).fill(email); await c.nth(3).fill('senha123');
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(500);
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(500);
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3200);
}
// A partir da 5.9.8, entrar numa conta vazia com dados de outra conta no
// aparelho faz o app oferecer trazê-los (ver t100). Aqui esse convite só
// atrapalha: o que este teste quer é o estado com três cofres.
async function dispensarConvite() {
  const aberto = await page.evaluate(() => {
    const d = document.getElementById('dialogoFundo');
    return !!(d && !d.hidden);
  });
  if (!aberto) return;
  await page.click('#dialogoAcoes button:has-text("Agora não")').catch(() => {});
  await page.waitForTimeout(900);
}

async function sair() {
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
  await page.click('#telaMais .linha:has-text("Sair da conta")'); await page.waitForTimeout(900);
  await page.click('#dialogoAcoes button:has-text("Sair da conta")'); await page.waitForTimeout(3000);
}
const quantosCofres = () => page.evaluate(() =>
  Object.keys(localStorage).filter(k => k.indexOf('caixa.cofre.') === 0).length);

// --- conta 1: a de verdade, com dados ---
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await criarConta('Vitor', 't99a-' + selo + '@exemplo.com');
await page.click('#fab'); await page.waitForTimeout(1000);
await page.locator('#folha input[inputmode=numeric]').first().fill('54321');
await page.locator('#folha input.entrada[type=text]').first().fill('Tesouro guardado');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await folhaFechou(); await page.waitForTimeout(2500);
conferir('1. a conta cheia tem os dados', /543,21/.test(limpo(await page.textContent('#telaInicio'))));

// --- contas 2 e 3: as do projeto novo, vazias ---
await sair();
await criarConta('Vitor', 't99b-' + selo + '@exemplo.com');
await dispensarConvite();
await sair();
await criarConta('Vitor', 't99c-' + selo + '@exemplo.com');
await dispensarConvite();
await sair();

const cofres = await quantosCofres();
conferir('2. o aparelho tem três cofres, como no caso real', cofres === 3, cofres + ' cofre(s)');

// --- servidor fora, sessão apagada: a porta de trás ---
await page.evaluate(() => { localStorage.removeItem('caixa.nuvem.v3'); });
await page.route('**/auth/v1/**', (rota) => rota.abort('failed'));
await page.route('**/rest/v1/**', (rota) => rota.abort('failed'));
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(3000);
conferir('3. cai na tela de entrada com a porta de trás', await naEntrada()
  && /Abrir os dados deste aparelho/.test(limpo(await page.textContent('#entrada'))));

await page.click('#entrada button:has-text("Abrir os dados deste aparelho")');
await page.waitForTimeout(2800);

const perguntou = await page.evaluate(() => {
  const e = document.getElementById('escolhaLista');
  return !!(e && e.offsetParent !== null);
});
conferir('4. NÃO pergunta qual cofre: só um tem dados', !perguntou);

const dentro = limpo(await page.textContent('#telaInicio'));
conferir('5. e abriu justamente o cheio', /543,21/.test(dentro), dentro.slice(0, 110));
await page.screenshot({ path: dir+'/j01-sem-vazios.png', fullPage: true });

// --- com dois cofres cheios, aí sim pergunta, e com rótulo útil ---
await page.evaluate(() => {
  const chaves = Object.keys(localStorage).filter(k => k.indexOf('caixa.cofre.') === 0);
  // copia o cofre cheio por cima de um dos vazios: dois cheios de verdade
  let cheio = null, maior = 0;
  chaves.forEach(k => { const v = localStorage.getItem(k) || ''; if (v.length > maior) { maior = v.length; cheio = k; } });
  const vazio = chaves.find(k => k !== cheio);
  localStorage.setItem(vazio, localStorage.getItem(cheio));
});
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(3000);
await page.click('#entrada button:has-text("Abrir os dados deste aparelho")');
await page.waitForTimeout(2500);

const escolha = limpo(await page.textContent('#escolhaLista'));
console.log('escolha:', escolha.slice(0, 200));
conferir('6. com dois cheios ele pergunta', escolha.length > 0, escolha.slice(0, 90));
conferir('7. e o rótulo diz o que tem dentro, não um código de conta',
  /lançamento/.test(escolha) && !/^conta [0-9a-f]{8}/.test(escolha), escolha.slice(0, 90));
conferir('8. e não lista os vazios junto', !/nada guardado ainda/.test(escolha));
await page.screenshot({ path: dir+'/j02-dois-cheios.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: cofre vazio não aparece na escolha');

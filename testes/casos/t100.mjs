// Entrar numa conta vazia com dados de outra conta no mesmo aparelho.
//
// Em 19/10/2026 o Vitor trocou de projeto no servidor, entrou com o
// Google e viu tudo zerado. Os 3520 lançamentos estavam no cofre da
// conta anterior, neste mesmo aparelho, intactos — e o app não dizia
// uma palavra sobre isso. Ele reinstalou o app achando que ia consertar
// e o Android apagou os dados do site junto.
//
// O caminho existia (backup, sair, restaurar), mas ninguém adivinha isso
// olhando uma tela zerada. Este teste é o convite que faltava.
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
async function sair() {
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
  await page.click('#telaMais .linha:has-text("Sair da conta")'); await page.waitForTimeout(900);
  await page.click('#dialogoAcoes button:has-text("Sair da conta")'); await page.waitForTimeout(3000);
}

// --- conta 1: a de verdade, com dados ---
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await criarConta('Vitor', 't100a-' + selo + '@exemplo.com');
await page.click('#fab'); await page.waitForTimeout(1000);
await page.locator('#folha input[inputmode=numeric]').first().fill('54321');
await page.locator('#folha input.entrada[type=text]').first().fill('Tesouro guardado');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await folhaFechou(); await page.waitForTimeout(2500);
conferir('1. a conta antiga tem os dados', /543,21/.test(limpo(await page.textContent('#telaInicio'))));
await sair();

// --- conta 2: o "projeto novo", conta nova e vazia ---
await criarConta('Vitor', 't100b-' + selo + '@exemplo.com');
await page.waitForTimeout(2500);

// O convite tem de aparecer sozinho.
const convite = limpo(await page.textContent('#dialogoFundo').catch(() => ''));
console.log('convite:', convite.slice(0, 200));
conferir('2. o app avisa que a conta está vazia', /Esta conta está vazia/.test(convite), convite.slice(0, 90));
conferir('3. e diz o que achou no aparelho', /lançamento/.test(convite), convite.slice(0, 120));
await page.screenshot({ path: dir+'/k01-convite.png', fullPage: true });

// --- aceitar o convite traz os dados ---
await page.click('#dialogoAcoes button:has-text("Trazer")'); await page.waitForTimeout(1200);
const confirma = limpo(await page.textContent('#dialogoFundo').catch(() => ''));
conferir('4. pede confirmação antes de substituir', /Trazer estes dados/.test(confirma), confirma.slice(0, 90));
await page.click('#dialogoAcoes button:has-text("Trazer")'); await page.waitForTimeout(4000);
await page.click('#dialogoAcoes button').catch(() => {});   // fecha o "Pronto"
await page.waitForTimeout(1200);

await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
const dentro = limpo(await page.textContent('#telaInicio'));
conferir('5. os dados chegaram na conta nova', /543,21/.test(dentro), dentro.slice(0, 110));
await page.screenshot({ path: dir+'/k02-trouxe.png', fullPage: true });

// --- e subiram para o servidor: recarregar não perde ---
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(3500);
conferir('6. e continuam lá depois de recarregar',
  /543,21/.test(limpo(await page.textContent('#telaInicio'))));

// --- o convite não insiste depois de aceito ---
const semConvite = await page.evaluate(() => {
  const d = document.getElementById('dialogoFundo');
  return !d || d.hidden;
});
conferir('7. e o convite não aparece de novo', semConvite);

// --- o caminho manual continua no menu, para quem disse "agora não" ---
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1000);
const mais = limpo(await page.textContent('#telaMais'));
conferir('8. o menu Mais oferece trazer de outra conta',
  /Trazer dados de outra conta/.test(mais));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: conta vazia oferece trazer os dados do aparelho');

// Restaurar por cima de uma conta grande: a limpeza também lia só mil.
//
// "Substitui os dados atuais" é o que a tela promete, e para cumprir isso
// o app precisa tirar do servidor o que não veio no backup — senão o
// envio é só upsert, o que estava lá continua lá, e o download seguinte
// soma as duas levas.
//
// A lista do que tirar vinha do mesmo GET sem paginação do download, e
// por isso parava nas primeiras mil linhas. Quem tinha mais do que mil
// restaurava, via os números certos por um instante, e na sincronização
// seguinte o excedente voltava inteiro. "Acho que tá restaurando mais que
// uma vez", escreveu o Vitor em 26/10/2026.
//
// Aqui: backup com 1 lançamento, servidor com 1101, restaura, sincroniza.
// Tem que sobrar 1 no servidor. Antes sobravam 101.
import { chromium, dir, ENDERECO } from '../comum.mjs';

const SEMEADOS = 1100;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2,
  acceptDownloads: true });
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
const semDialogo = async () => {
  if (!(await page.locator('#dialogoFundo.aberta').count())) return '';
  const t = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
  const bs = page.locator('#dialogoAcoes button');
  await bs.nth((await bs.count()) - 1).click();
  await page.waitForTimeout(900);
  return t;
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
  if (!(await page.locator('#telaInicio:visible').count())) return '(não cheguei no Início)';
  const t = limpo(await page.textContent('#telaInicio'));
  const m = t.match(/Total em contas\s*(−?-?R\$ [\d.,]+)/);
  return m ? m[1].replace('−', '-') : '(não achei)';
};
const sincronizar = async (espera) => {
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
  await page.click('#telaMais .linha:has-text("Sincronizar agora")');
  await page.waitForTimeout(espera);
  await semDialogo();
};
// Conta as linhas vivas no servidor passando por cima do teto, para o
// próprio contador não cair na armadilha que está sendo testada.
const vivosNoServidor = async () => page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const cab = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token };
  let total = 0, pulo = 0;
  for (let i = 0; i < 20; i++) {
    const r = await fetch(cfg.supabaseUrl +
      '/rest/v1/lancamentos?select=id&excluido_em=is.null&order=id.asc&limit=1000&offset=' + pulo,
      { headers: cab });
    const pagina = await r.json();
    if (!pagina.length) break;
    total += pagina.length; pulo += pagina.length;
  }
  return total;
});

// ---- conta, conta bancária e um lançamento de R$ 320,00 ----
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t130-' + Date.now() + '-' + process.pid + '@exemplo.com');
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
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1600);
await sincronizar(6000);

// ---- o backup deste momento: um lançamento só ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
const baixando = page.waitForEvent('download');
await page.click('#telaMais .linha:has-text("Fazer backup")'); await page.waitForTimeout(1500);
const arquivo = dir + '/t130-backup-' + process.pid + '.json';
await (await baixando).saveAs(arquivo);
await semDialogo();
console.log('backup guardado com 1 lançamento');

// ---- e agora o servidor cresce para 1101 ----
const semeadura = await page.evaluate(async (quantos) => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const cab = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token,
                'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const contas = await (await fetch(cfg.supabaseUrl + '/rest/v1/contas?select=id', { headers: cab })).json();
  const hoje = new Date().toISOString().slice(0, 10);
  const marca = pac.usuario.id.slice(0, 8);
  const linhas = [];
  for (let i = 0; i < quantos; i++) {
    linhas.push({ id: 'sem-' + marca + '-' + String(i).padStart(5, '0'), user_id: pac.usuario.id,
      tipo: 'saida', valor: 1, descricao: 'Centavo ' + i, categoria: 'Outros',
      data: hoje, conta_id: contas[0].id });
  }
  const estados = [];
  for (let i = 0; i < linhas.length; i += 275) {
    const r = await fetch(cfg.supabaseUrl + '/rest/v1/lancamentos', {
      method: 'POST', headers: cab, body: JSON.stringify(linhas.slice(i, i + 275)) });
    estados.push(r.status);
  }
  return estados.join(' ');
}, SEMEADOS);
console.log('semeadura ·', semeadura);

await sincronizar(14000);
const cheio = await totalEmContas();
conferir('1. com os ' + (SEMEADOS + 1) + ' no aparelho, o total é −R$ 331,00',
  cheio === '-R$ 331,00', cheio);

// ---- restaura o backup de um lançamento por cima de tudo isso ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
page.on('filechooser', async (fc) => { await fc.setFiles(arquivo); });
await page.click('#telaMais .linha:has-text("Restaurar backup")'); await page.waitForTimeout(2500);
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(4000);
await semDialogo();
const logoApos = await totalEmContas();
conferir('2. logo depois de restaurar, o aparelho mostra −R$ 320,00',
  logoApos === '-R$ 320,00', logoApos);
await page.screenshot({ path: dir+'/y19-restaurado.png', fullPage: true });

// ---- a sincronização leva a substituição inteira para o servidor ----
//
// São 1100 linhas para marcar como excluídas, uma a uma. Em vez de
// esperar um tempo chutado, pergunto ao servidor até ele chegar lá — e
// desisto em dois minutos, que é falha de verdade e não suíte travada.
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Sincronizar agora")');
let sobrou = 0;
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(2000);
  sobrou = await vivosNoServidor();
  if (sobrou === 1) break;
}
await semDialogo();
conferir('3. sobrou 1 lançamento vivo no servidor (antes sobravam 102)',
  sobrou === 1, sobrou + ' vivo(s)');

// ---- e nada volta na sincronização seguinte ----
await sincronizar(14000);
const depois = await totalEmContas();
conferir('4. a sincronização seguinte não traz nada de volta', depois === '-R$ 320,00', depois);
await page.screenshot({ path: dir+'/y20-nada-voltou.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: restaurar substitui mesmo, passando do teto de mil');

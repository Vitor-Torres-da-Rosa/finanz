// Cópia a cada mexida, e a nuvem resgatando conta vazia.
//
// Pedido do Vitor em 24/10/2026: "não seja mais por dia e sim por
// qualquer alteração feita no app pelo usuário", e "quando atualizar para
// uma nova versão que se mantenha esses dados do último backup".
//
// A do dia responde "me leva para ontem". A de alteração responde "desfaz
// o que eu acabei de fazer" — e erro não é só exclusão: é valor trocado,
// data errada, conta errada.
//
// A segunda parte é a rede que não depende deste aparelho: entrando numa
// conta vazia, se a nuvem tiver cópia, o app oferece voltar para ela.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
// O relógio da cópia por alteração é de 45 segundos no app. Aqui ele vai a
// 4 pelo cookie que o servir.cjs entende, só para esta aba: o caminho
// testado é o mesmo, muda o relógio. Antes este teste sozinho levava 52
// segundos parado esperando.
await ctx.addCookies([{ name:'esperainstantaneo', value:'4000', domain:'127.0.0.1', path:'/' }]);
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
const copias = async () => page.evaluate(async () => {
  const pac = localStorage.getItem('caixa.nuvem.v4');
  if (!pac) return [];
  const tok = JSON.parse(pac).access_token;
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/instantaneos?select=motivo,resumo,criado_em', {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok } });
  return (await r.json()).map((i) => i.motivo);
});

let emailDaConta = '';
async function criarConta(marca) {
  await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
  const c = page.locator('.ent-campo input');
  emailDaConta = marca + '-' + Date.now() + '-' + process.pid + '@exemplo.com';
  await c.nth(0).fill('Vitor');
  await c.nth(1).fill(emailDaConta);
  await c.nth(3).fill('senha123');
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
}

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await criarConta('t113');

await irParaInicio();
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1300);
await page.click('#fab'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '32000');
await folha().locator('input.entrada[type=text]').first().fill('Aluguel');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1600);
conferir('1. o estado é −R$ 320,00', (await totalEmContas()) === '-R$ 320,00');

// ---- a cópia por alteração sai sozinha depois do sossego ----
await page.waitForTimeout(9000);
const motivos = await copias();
console.log('motivos na nuvem:', JSON.stringify(motivos));
conferir('2. mexer no app guardou uma cópia de alteração',
  motivos.indexOf('alteração') >= 0, JSON.stringify(motivos));

// ---- ela aparece na folha, com a hora como identidade ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1000);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
const naFolha = limpo(await page.textContent('#folha'));
console.log('folha:', naFolha.slice(0, 280));
conferir('3. a folha explica que guarda a cada mexida',
  /sempre que você mexe em alguma coisa/.test(naFolha), naFolha.slice(0, 140));
conferir('4. e a cópia de alteração aparece pela hora',
  /hoje às \d{2}:\d{2}/.test(naFolha), (naFolha.match(/hoje às \d{2}:\d{2}[^·]*/) || ['(não achei)'])[0]);
await page.screenshot({ path: dir+'/y03-copia-por-alteracao.png', fullPage: true });

// ---- conta vazia: a nuvem resgata ----
//
// O cenário: os dados sumiram do aparelho E das tabelas da nuvem, e só as
// cópias restaram. É o medo do Vitor ao atualizar de versão, e é também o
// que acontece com quem apaga algo grande por engano e a sincronização
// leva o estrago para o servidor antes de alguém perceber.
//
// Apago as linhas vivas pela API em vez de pelo app de propósito: o que
// está em teste aqui é o resgate na entrada, não o caminho que perdeu o
// dado. Com a nuvem vazia e as cópias de pé, entrar na conta tem que
// oferecer a mais nova.
const apagados = await page.evaluate(async () => {
  const tok = JSON.parse(localStorage.getItem('caixa.nuvem.v4')).access_token;
  const cfg = window.FINANZ_CONFIG;
  const cab = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok };
  const uid = JSON.parse(localStorage.getItem('caixa.nuvem.v4')).usuario.id;
  const fora = [];
  for (const t of ['lancamentos', 'contas']) {
    const r = await fetch(cfg.supabaseUrl + '/rest/v1/' + t + '?user_id=eq.' + uid,
      { method: 'DELETE', headers: cab });
    fora.push(t + ':' + r.status);
  }
  return fora.join(' ');
});
console.log('linhas vivas apagadas ·', apagados);

// E apago TUDO do aparelho, como quem reinstala o app ou troca de celular.
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(2500);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-contorno:has-text("Entrar na minha conta")'); await page.waitForTimeout(1200);
const campos = page.locator('.ent-campo input');
await campos.nth(0).fill(emailDaConta);
await campos.nth(1).fill('senha123');
await page.click('.btn-dourado:has-text("Entrar")'); await page.waitForTimeout(12000);
const tituloConvite = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
const convite = limpo(await page.textContent('#dialogoTexto').catch(() => ''));
console.log('convite:', tituloConvite, '|', convite.slice(0, 200));
conferir('5. entrando numa conta vazia, o app oferece a cópia da nuvem',
  /Esta conta está vazia/.test(tituloConvite) && /a nuvem tem (uma|\d+) cópias? dos seus dados/.test(convite),
  tituloConvite + ' · ' + convite.slice(0, 130));
await page.screenshot({ path: dir+'/y04-convite-da-nuvem.png', fullPage: true });

// O botão de aceitar é o primeiro; "Agora não" é o outro.
const aceitar = page.locator('#dialogoAcoes button').filter({ hasText: /Voltar para/ });
conferir('6. o botão diz para que hora volta', (await aceitar.count()) === 1,
  limpo(await page.textContent('#dialogoAcoes').catch(() => '')));
// Sem o convite não há o que clicar — e aí o que interessa é a verificação
// 7 falhando com o valor que apareceu, não a suíte morrendo de timeout.
if (await aceitar.count()) {
  await aceitar.first().click(); await page.waitForTimeout(14000);
  await semDialogo();
}
const voltou = await totalEmContas();
conferir('7. aceitando, os dados voltam', voltou === '-R$ 320,00', voltou);
await page.screenshot({ path: dir+'/y05-resgatado.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: cópia a cada mexida, e a nuvem resgata conta vazia');

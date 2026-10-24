// Trocar de versão não perde o que foi feito agora.
//
// Pedido do Vitor em 24/10/2026: "quando atualizar para uma nova versão
// que se mantenha esses dados do último backup".
//
// Atualizar nunca apagou dado: o service worker limpa o cache de
// arquivos, nunca o cofre. O que se perdia era a cópia de alteração ainda
// esperando os 45 segundos de sossego — a pessoa mexia, apertava
// "Atualizar", e aquele ponto de volta nunca chegava à nuvem.
//
// Aqui o teste faz a atualização de verdade: troca o sw.js por um
// diferente só nesta aba, pede ao navegador para procurar atualização,
// espera o aviso de versão nova aparecer e aperta o botão.
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
  if (!(await page.locator('#telaInicio:visible').count())) return '(não cheguei no Início)';
  const t = limpo(await page.textContent('#telaInicio'));
  const m = t.match(/Total em contas\s*(−?-?R\$ [\d.,]+)/);
  return m ? m[1].replace('−', '-') : '(não achei)';
};
const copias = async () => page.evaluate(async () => {
  const pac = localStorage.getItem('caixa.nuvem.v3');
  if (!pac) return [];
  const tok = JSON.parse(pac).access_token;
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/instantaneos?select=motivo,resumo', {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok } });
  return (await r.json()).map((i) => i.motivo + ' (' + i.resumo + ')');
});

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t114-' + Date.now() + '-' + process.pid + '@exemplo.com');
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
conferir('1. o estado é −R$ 320,00', (await totalEmContas()) === '-R$ 320,00');

// A cópia de alteração espera 45 segundos. Neste instante ela ainda não
// existe, e é justamente esse o momento perigoso: a pessoa aperta
// "Atualizar" e o ponto de volta do que ela acabou de fazer não subiu.
const antes = await copias();
conferir('2. a cópia da mexida ainda não subiu', antes.length === 0, JSON.stringify(antes));

// ---- a atualização de verdade ----
//
// Peço ao servidor dos testes um sw.js com outra versão, só para esta
// aba: byte diferente é o que o navegador usa para decidir que existe
// versão nova. Vai por cookie porque o pedido do service worker não passa
// por page.route — nem pelo do Playwright. E trocar o arquivo no disco
// faria todos os testes rodando ao mesmo tempo verem atualização.
await ctx.addCookies([{ name:'swversao', value:'99.0.0-teste', domain:'127.0.0.1', path:'/' }]);

await page.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  if (r) await r.update().catch(() => {});
});
await page.locator('#avisoVersao').waitFor({ state:'visible', timeout: 30000 }).catch(() => {});
const temAviso = await page.locator('#avisoVersao').count();
conferir('3. o aviso de versão nova apareceu', temAviso === 1,
  limpo(await page.textContent('#avisoVersao').catch(() => '(nenhum)')));
await page.screenshot({ path: dir+'/z01-aviso-de-versao.png' });

if (temAviso) {
  // Aperto e leio o rótulo no mesmo passo. O que troca o texto roda
  // dentro do clique, então o valor já é o novo quando o click() volta —
  // esperar para ler é corrida perdida: com o servidor na mesma máquina a
  // página já recarregou, e aí não há botão nenhum para ler.
  const rotulo = limpo(await page.evaluate(() => {
    const b = document.querySelector('#avisoVersao button');
    b.click();
    return b.textContent;
  }));
  conferir('4. o botão avisa que está guardando primeiro', /Guardando/.test(rotulo), rotulo);
  // O recarregamento vem do controllerchange, que chega quando o sw novo
  // assume. Espero a página voltar inteira.
  await page.waitForTimeout(12000);
}

await page.waitForFunction(() => !!document.getElementById('navegacao'), null, { timeout: 20000 }).catch(() => {});
await page.waitForTimeout(2500);

const depois = await copias();
console.log('cópias na nuvem:', JSON.stringify(depois));
conferir('5. a atualização guardou uma cópia antes de trocar de versão',
  depois.some((m) => /^antes de atualizar o app/.test(m)), JSON.stringify(depois));
conferir('6. e ela tem o que estava na tela, não um estado vazio',
  depois.some((m) => /^antes de atualizar o app .*1 lançamentos/.test(m)), JSON.stringify(depois));

// E o que o Vitor teme: os dados continuam aí depois de atualizar.
//
// ATENÇÃO: esta verificação passa COM e SEM a mudança desta versão, e é
// de propósito. Atualizar nunca apagou nada — o service worker só limpa o
// cache de arquivos. Ela fica aqui para provar isso de novo a cada
// rodada: no dia em que alguém mexer no sw.js e começar a limpar o
// localStorage, é ela que acende.
const agora = await totalEmContas();
conferir('7. depois de atualizar, os dados continuam', agora === '-R$ 320,00', agora);
await page.screenshot({ path: dir+'/z02-depois-de-atualizar.png', fullPage: true });

// A cópia aparece na folha com cara de atualização, não de exclusão.
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1000);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
const naFolha = limpo(await page.textContent('#folha'));
conferir('8. a folha mostra a cópia como "Antes de atualizar o app"',
  /Antes de atualizar o app/.test(naFolha),
  (naFolha.match(/Antes de atualizar o app[^›]*/) || ['(não achei)'])[0].slice(0, 90));
await page.screenshot({ path: dir+'/z03-na-folha.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: a troca de versão guarda o ponto de volta antes de recarregar');

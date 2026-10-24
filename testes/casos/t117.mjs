// A sincronização que falhou tem que tentar de novo sozinha.
//
// Reclamação do Vitor em 24/10/2026: "sincronização tá dando falha". O
// servidor estava de pé (GoTrue 200, PostgREST 200, projeto saudável), e
// mesmo assim o app ficava com o aviso vermelho em Mais.
//
// Três buracos no caminho, e os três estão neste teste:
//
//  1. Nada reagendava depois de um erro. Um tropeço de rede, o celular que
//     dormiu, o servidor acordando de uma pausa — e o app ficava parado
//     com o aviso até a pessoa mexer em alguma coisa. Os dados do dia não
//     subiam e ninguém avisava de novo.
//  2. Voltar para o app ou recuperar a internet não tentava nada.
//  3. E o aviso não dizia o que tinha acontecido: a frase ia numa classe
//     que corta em uma linha só. "Não está sincronizando" e mais nada.
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

// Quantos lançamentos o SERVIDOR tem. É a única prova que vale: a tela
// mostra o que está no aparelho, que continua certo mesmo sem subir.
const noServidor = async () => page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v3'));
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/lancamentos?select=descricao&excluido_em=is.null', {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
  return (await r.json()).map((l) => l.descricao).sort();
});

// A linha de sincronização em Mais, como a pessoa a lê.
const linhaDeSincronia = async () => {
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const linhas = [...document.querySelectorAll('#telaMais .linha')];
    const l = linhas.find((x) => /Não está sincronizando|Sincronizar agora/.test(x.textContent || ''));
    if (!l) return null;
    const sub = l.querySelector('.linha-sub');
    return {
      titulo: (l.querySelector('.linha-titulo') || {}).textContent || '',
      recado: (sub || {}).textContent || '',
      cortado: sub ? sub.scrollWidth > sub.clientWidth + 1 : false
    };
  });
};

const novoLancamento = async (nome, valor) => {
  await irParaInicio();
  await page.click('#fab'); await page.waitForTimeout(900);
  await porDinheiro(folha().locator('.valor-grande'), valor);
  await folha().locator('input.entrada[type=text]').first().fill(nome);
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t117-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await irParaInicio();
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1300);
await novoLancamento('Aluguel', '32000');
await page.waitForTimeout(3000);
conferir('1. o que eu lanço chega ao servidor',
  JSON.stringify(await noServidor()) === '["Aluguel"]', JSON.stringify(await noServidor()));

// ---- a rede cai no meio ----
const cortarRede = async () => ctx.route('**/rest/v1/**', (r) => r.abort());
const religarRede = async () => ctx.unroute('**/rest/v1/**');

await cortarRede();
await novoLancamento('Luz', '18000');
await page.waitForTimeout(9000);
const falhou = await linhaDeSincronia();
console.log('linha em Mais:', JSON.stringify(falhou));
conferir('2. o app percebe que não está sincronizando',
  !!falhou && /Não está sincronizando/.test(falhou.titulo), falhou && falhou.titulo);
conferir('3. e conta o que aconteceu, sem cortar a frase',
  !!falhou && !falhou.cortado && /tentativa/.test(falhou.recado) && falhou.recado.length > 60,
  falhou && (limpo(falhou.recado).slice(0, 120) + (falhou.cortado ? ' [CORTADO]' : '')));
conferir('4. o recado diz qual pedido falhou',
  !!falhou && /rest\/v1\//.test(falhou.recado), falhou && limpo(falhou.recado).slice(0, 120));
await page.screenshot({ path: dir+'/z06-falha-explicada.png', fullPage: true });

// ---- a rede volta, e o app tem que se virar sozinho ----
//
// Sem tocar em nada: a primeira nova tentativa é aos 15 segundos. Antes
// desta versão, nada aqui reagendava — o "Luz" ficava só no aparelho até
// a pessoa lançar outra coisa.
await religarRede();
await page.waitForTimeout(22000);
const depois = await noServidor();
console.log('no servidor depois da espera:', JSON.stringify(depois));
conferir('5. sozinho, sem ninguém tocar no app, ele sobe o que faltava',
  JSON.stringify(depois) === '["Aluguel","Luz"]', JSON.stringify(depois));
const curado = await linhaDeSincronia();
conferir('6. e o aviso vermelho some', !!curado && /Sincronizar agora/.test(curado.titulo),
  curado && curado.titulo);

// ---- voltar para o app tenta na hora, sem esperar relógio ----
await cortarRede();
await novoLancamento('Água', '9000');
await page.waitForTimeout(9000);
const falhou2 = await linhaDeSincronia();
conferir('7. falhou de novo, como esperado',
  !!falhou2 && /Não está sincronizando/.test(falhou2.titulo), falhou2 && falhou2.titulo);

await religarRede();
// O celular saindo do bolso. É mais rápido que a nova tentativa marcada,
// e é a hora em que a pessoa está olhando.
await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
await page.waitForTimeout(6000);
const depois2 = await noServidor();
conferir('8. voltar para o app sobe o que faltava na hora',
  JSON.stringify(depois2) === '["Aluguel","Luz","Água"]', JSON.stringify(depois2));

// ---- e recuperar a internet também ----
await cortarRede();
await novoLancamento('Gás', '4000');
await page.waitForTimeout(9000);
await religarRede();
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(6000);
const depois3 = await noServidor();
// Comparo como conjunto: a ordem do sort() com acento não é a que se
// espera lendo ("Gás" antes de "Luz", "Água" por último) e não é o que
// está em teste aqui.
const mesmos = (a, b) => a.length === b.length && b.every((x) => a.indexOf(x) >= 0);
conferir('9. recuperar a internet também',
  mesmos(depois3, ['Aluguel', 'Luz', 'Água', 'Gás']), JSON.stringify(depois3));
await page.screenshot({ path: dir+'/z07-sincronizado-de-volta.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: a sincronização se recupera sozinha e explica o que deu errado');

// Só baixar quando mudou alguma coisa.
//
// Pedido do Vitor em 25/10/2026, depois de eu medir o gasto de tráfego:
// toda sincronização baixava o conjunto inteiro, mesmo quando nada tinha
// mudado no servidor. Numa conta com 1000 lançamentos são 389 KB por vez,
// vinte a cinquenta vezes por dia, por pessoa — o que limitava o servidor
// a umas cem contas.
//
// E quase sempre não mudou nada: na maioria das vezes quem mexeu foi o
// próprio aparelho que está perguntando.
//
// A função carimbo_da_conta() responde "qual é a alteração mais recente?"
// em trinta bytes. Igual ao que o app guardou, ele pula a descida.
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
  const t = limpo(await page.textContent('#telaInicio').catch(() => ''));
  const m = t.match(/Total em contas\s*(−?-?R\$ [\d.,]+)/);
  return m ? m[1].replace('−', '-') : '(não achei)';
};

// Conta os bytes que DESCEM das tabelas. O carimbo não entra: ele é o
// pedido barato que existe justamente para evitar os caros.
let baixado = 0, perguntas = 0;
page.on('response', async (r) => {
  const u = r.url();
  if (u.indexOf('/rest/v1/') < 0) return;
  if (u.indexOf('/rpc/carimbo_da_conta') >= 0) { perguntas++; return; }
  // Só as tabelas de dados. A faxina das cópias (instantaneos,
  // arquivos_extrato) tem o seu próprio caminho e pesa uns poucos bytes;
  // misturar as duas coisas faria o teste medir a errada.
  if (!/\/rest\/v1\/(perfis|contas|lancamentos|ativos|ativo_historico|clientes|servicos|pagamentos|parcelas|metas|orcamentos|categorias_extras|subcategorias_extras)\b/.test(u)) return;
  if (r.request().method() !== 'GET') return;
  try { baixado += (await r.body()).length; } catch (e) { /* sem corpo */ }
});

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t125-' + Date.now() + '-' + process.pid + '@exemplo.com');
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
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(6000);

// Reabrir o app com nada mudado: não pode baixar tabela nenhuma — e tem
// de perguntar o carimbo, senão não é economia, é cegueira.
baixado = 0; perguntas = 0;
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(20000);
console.log('reabrindo sem nada ter mudado: baixou', baixado, 'bytes em', perguntas, 'pergunta(s)');
conferir('1. reabrindo sem nada ter mudado, não baixa tabela nenhuma',
  baixado === 0, baixado + ' bytes');
conferir('2. mas pergunta ao servidor se mudou', perguntas >= 1, perguntas + ' pergunta(s)');
conferir('3. e os dados continuam na tela', (await totalEmContas()) === '-R$ 320,00',
  await totalEmContas());

// Outro aparelho mexe. Agora tem de baixar de novo — senão a economia
// seria só deixar de ver o que os outros fazem.
await page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  await fetch(cfg.supabaseUrl + '/rest/v1/lancamentos', {
    method: 'POST',
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token,
               'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify([{ id: 'outro-' + Date.now(), user_id: pac.usuario.id,
      tipo: 'saida', valor: 7700, descricao: 'Veio do outro aparelho',
      categoria: 'Outros', data: '2026-10-20', conta_id: null }]) });
});

baixado = 0;
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(20000);
console.log('depois de outro aparelho mexer, baixou', baixado, 'bytes');
conferir('4. mexendo de outro aparelho, ele volta a baixar', baixado > 500, baixado + ' bytes');
const naTela = limpo(await page.textContent('#telaTransacoes').catch(() => ''));
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1500);
const transacoes = limpo(await page.textContent('#telaTransacoes').catch(() => ''));
conferir('5. e o que o outro aparelho criou aparece aqui',
  /Veio do outro aparelho/.test(transacoes), transacoes.slice(0, 120));
await page.screenshot({ path: dir+'/z20-so-baixa-se-mudou.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: só desce o que precisa descer');

// A enxurrada de cópias de alteração não pode varrer as de antes de apagar.
//
// Agora que cada mexida guarda uma cópia, uma tarde de uso gera dezenas
// delas. Com um teto só para tudo que não é a cópia do dia, a cópia de
// ontem de "antes de apagar tudo" — a única que alguém realmente vai
// procurar — saía empurrada por cópias de alteração de hoje à tarde.
//
// Dois tetos: 60 de alteração, 40 do resto. Este teste enche a nuvem de
// cópias de alteração e confere que as de antes de apagar continuam lá.
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
const contar = async () => page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/instantaneos?select=motivo', {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
  const conta = {};
  (await r.json()).forEach((i) => { conta[i.motivo] = (conta[i.motivo] || 0) + 1; });
  return conta;
});

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t115-' + Date.now() + '-' + process.pid + '@exemplo.com');
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

// Encho a nuvem como uma tarde de uso pesado encheria: 70 cópias de
// alteração, e três de antes de apagar que são mais velhas que todas elas.
// `dados` vai curto de propósito — nada aqui descomprime nada; o que está
// em teste é quem sobrevive à limpeza.
//
// Os ids vão com marca da rodada: o id da linha é a chave primária global
// da tabela, não por usuário, e repetir um id de outra rodada devolve 400
// — insere nada e o teste passaria por engano.
const antes = await page.evaluate(async (marca) => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const linhas = [];
  const base = Date.now() - 6 * 3600 * 1000;
  for (let i = 0; i < 3; i++) linhas.push({
    id: marca + '-velha' + i, user_id: pac.usuario.id, dia: new Date().toISOString().slice(0, 10),
    motivo: 'antes de apagar ' + (i + 1) + ' lançamento(s) importantes',
    resumo: 'de antes', dados: 'x', tamanho: 1,
    criado_em: new Date(base + i * 1000).toISOString() });
  for (let i = 0; i < 70; i++) linhas.push({
    id: marca + '-mexida' + i, user_id: pac.usuario.id, dia: new Date().toISOString().slice(0, 10),
    motivo: 'alteração', resumo: 'da enxurrada', dados: 'x', tamanho: 1,
    criado_em: new Date(base + 3600 * 1000 + i * 1000).toISOString() });
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/instantaneos', {
    method: 'POST',
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token,
               'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(linhas) });
  return r.status;
}, Date.now() + '-' + process.pid);
console.log('enchi a nuvem ·', antes);
const contagemAntes = await contar();
console.log('antes da limpeza:', JSON.stringify(contagemAntes));
conferir('1. a nuvem está cheia de cópias de alteração',
  contagemAntes['alteração'] >= 70 && contagemAntes['antes de apagar 1 lançamento(s) importantes'] === 1,
  JSON.stringify(contagemAntes));

// Qualquer cópia nova dispara a limpeza. Uso o botão de guardar na hora,
// que é o caminho da pessoa.
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1000);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
await page.click('#folha button:has-text("Guardar uma cópia agora")'); await page.waitForTimeout(6000);

const depois = await contar();
console.log('depois da limpeza:', JSON.stringify(depois));
// Desde a 5.17.0 a regra é mais dura: de cada dia fica UMA cópia de
// alteração, a última. As 70 da enxurrada são todas de hoje, então sobra
// uma. Quem cobre essa regra por inteiro, com vários dias, é o t120; aqui
// ela entra só para o número bater.
conferir('2. a enxurrada do dia virou uma cópia só', depois['alteração'] === 1,
  String(depois['alteração']));
const exclusoes = Object.keys(depois).filter((m) => /^antes de apagar/.test(m)).length;
conferir('3. as três de antes de apagar continuam lá', exclusoes === 3, String(exclusoes));
conferir('4. e a cópia feita à mão entrou', depois['cópia feita por você'] === 1,
  String(depois['cópia feita por você']));

// As de antes de apagar são as mais velhas de todas. Com um teto único de
// 40 para tudo que não é a cópia do dia, elas seriam as primeiras a sair —
// é exatamente este o defeito que o teste existe para pegar: a cópia que
// alguém vai procurar de verdade, varrida por cópias automáticas de uma
// tarde movimentada.
await page.screenshot({ path: dir+'/z04-tetos-por-tipo.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: a enxurrada de alterações não varre as cópias de antes de apagar');

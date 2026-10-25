// Uma cópia de alteração por dia, e catorze dias de histórico.
//
// Pedido do Vitor em 24/10/2026: "apesar de poder fazer mais de 100 backup
// em um único dia, pois é por alteração e não por dia, vai ficar salvo
// apenas o último backup daquele dia" — e "o histórico de backup tem que
// manter até 14 dias anteriores".
//
// Entre a cópia das 14h03 e a das 14h04 de um mesmo dia quase nada muda, e
// quem volta no tempo volta para um dia. Guardar as cem é pagar cem vezes
// pelo mesmo dia.
//
// Vale só para as de alteração: a de antes de apagar é procurada pela
// frase do que ia sair, e pode haver várias num dia que importam todas.
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
const copias = async () => page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/instantaneos?select=dia,motivo,resumo', {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
  return await r.json();
});

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t120-' + Date.now() + '-' + process.pid + '@exemplo.com');
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
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2500);

// Duas semanas de uso, escritas direto na nuvem: 40 cópias de alteração
// hoje, 5 em cada um dos três dias anteriores, duas de antes de apagar, e
// uma de 20 dias atrás que já passou do prazo.
//
// Os ids levam marca da rodada: o id é a chave primária global da tabela,
// não por usuário, e repetir um id de outra rodada devolve 400 — não
// insere nada e o teste passaria por engano.
const posto = await page.evaluate(async (marca) => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const dia = (d) => { const x = new Date(); x.setDate(x.getDate() - d); return x; };
  const data = (d) => dia(d).toISOString().slice(0, 10);
  const quando = (d, min) => { const x = dia(d); x.setHours(8, min, 0, 0); return x.toISOString(); };
  const linhas = [];
  let n = 0;
  for (let i = 0; i < 40; i++) linhas.push({
    id: marca + '-h' + (n++), user_id: pac.usuario.id, dia: data(0), motivo: 'alteração',
    resumo: 'hoje nº ' + i, dados: 'x', tamanho: 1, criado_em: quando(0, i) });
  for (const d of [1, 2, 3]) for (let i = 0; i < 5; i++) linhas.push({
    id: marca + '-d' + (n++), user_id: pac.usuario.id, dia: data(d), motivo: 'alteração',
    resumo: 'dia -' + d + ' nº ' + i, dados: 'x', tamanho: 1, criado_em: quando(d, i) });
  for (const d of [1, 2]) linhas.push({
    id: marca + '-x' + (n++), user_id: pac.usuario.id, dia: data(d),
    motivo: 'antes de apagar ' + d + ' coisa(s) importantes',
    resumo: 'de antes', dados: 'x', tamanho: 1, criado_em: quando(d, 30) });
  linhas.push({ id: marca + '-velha', user_id: pac.usuario.id, dia: data(20),
    motivo: 'alteração', resumo: 'passou do prazo', dados: 'x', tamanho: 1,
    criado_em: quando(20, 0) });
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/instantaneos', {
    method: 'POST',
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token,
               'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify(linhas) });
  return r.status;
}, Date.now() + '-' + process.pid);
console.log('enchi a nuvem ·', posto);

const antes = await copias();
conferir('1. a nuvem está com dezenas de cópias de alteração no mesmo dia',
  antes.filter((i) => i.motivo === 'alteração').length >= 55, String(antes.length));

// Qualquer cópia nova dispara a limpeza. Uso o botão, que é o caminho da
// pessoa.
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
await page.click('#folha button:has-text("Guardar uma cópia agora")'); await page.waitForTimeout(8000);

const depois = await copias();
const porDia = {};
depois.filter((i) => i.motivo === 'alteração').forEach((i) => { porDia[i.dia] = (porDia[i.dia] || 0) + 1; });
console.log('alterações por dia:', JSON.stringify(porDia));
const diasComMaisDeUma = Object.keys(porDia).filter((d) => porDia[d] > 1);
conferir('2. de cada dia sobrou uma cópia de alteração só',
  diasComMaisDeUma.length === 0, JSON.stringify(porDia));

// E a que sobrou é a ÚLTIMA do dia, não uma qualquer.
const deHoje = depois.find((i) => i.motivo === 'alteração' && i.resumo.indexOf('hoje nº') === 0);
conferir('3. e a que ficou é a última da pessoa naquele dia',
  !!deHoje && deHoje.resumo === 'hoje nº 39', deHoje ? deHoje.resumo : '(nenhuma)');

conferir('4. os três dias anteriores continuam no histórico',
  Object.keys(porDia).length === 4, Object.keys(porDia).sort().join(' '));

conferir('5. as de antes de apagar ficaram todas',
  depois.filter((i) => /^antes de apagar/.test(i.motivo)).length === 2,
  String(depois.filter((i) => /^antes de apagar/.test(i.motivo)).length));

conferir('6. e a de vinte dias atrás saiu, que passou dos 14',
  !depois.some((i) => i.resumo === 'passou do prazo'),
  depois.some((i) => i.resumo === 'passou do prazo') ? 'ainda lá' : 'saiu');

await page.screenshot({ path: dir+'/z15-uma-por-dia.png', fullPage: true });
await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: uma de alteração por dia, catorze dias, e as deliberadas intactas');

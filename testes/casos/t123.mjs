// Substituir não pode virar união quando o envio falha no meio.
//
// Em 25/10/2026 as contas do Vitor apareceram em dobro: Banco Inter duas
// vezes, C6 Bank duas vezes, Itaú duas vezes, cada par com um pedaço dos
// lançamentos. Total em contas −R$ 42.854,29 onde devia ser metade disso.
//
// A corrente que leva até lá tem três elos, e os três estão aqui:
//
//  1. O envio apagava DEPOIS de mandar. Quebrando no meio, as linhas novas
//     já tinham subido e as velhas ainda não tinham saído — e o download
//     seguinte trazia as duas levas somadas.
//  2. A marca de "isto substitui o que está na nuvem" não sobrevivia a um
//     recarregamento: limparEstado() copia campo por campo e trocaTotal
//     não estava na lista. Quem restaurou, viu a sincronização falhar e
//     depois atualizou o app, perdia a marca — e a sincronização seguinte
//     virava acréscimo.
//  3. E o convite para trazer dados de outra conta aparecia mesmo com a
//     sincronização falhando, quando o app não sabe o que a conta tem.
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
const naConta = async () => page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const cab = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token };
  const pegar = async (t, q) => {
    const r = await fetch(cfg.supabaseUrl + '/rest/v1/' + t + '?' + q, { headers: cab });
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  };
  return {
    contas: (await pegar('contas', 'select=nome&excluido_em=is.null')).map((c) => c.nome).sort(),
    lancamentos: (await pegar('lancamentos', 'select=descricao&excluido_em=is.null'))
      .map((l) => l.descricao).sort()
  };
});
const novaConta = async (nome) => {
  await irParaInicio();
  await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
  await folha().locator('input.entrada[type=text]').first().fill(nome);
  await page.click('#folha .btn-ouro'); await page.waitForTimeout(1500);
};
const novoLancamento = async (nome, valor) => {
  await irParaInicio();
  await page.click('#fab'); await page.waitForTimeout(900);
  await porDinheiro(folha().locator('.valor-grande'), valor);
  await folha().locator('input.entrada[type=text]').first().fill(nome);
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1600);
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t123-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// O estado bom: uma conta, um lançamento.
await novaConta('Banco Inter');
await novoLancamento('Aluguel', '32000');
await page.waitForTimeout(4000);

// A cópia à mão é o ponto de volta. Ela não é recolhida pela regra de uma
// por dia, então serve de marco mesmo com outras saindo no caminho.
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
await page.click('#folha button:has-text("Guardar uma cópia agora")'); await page.waitForTimeout(7000);
await page.click('#cortina', { force: true }).catch(() => {}); await page.waitForTimeout(900);

// Depois da cópia vem mais coisa, que a volta tem de desfazer.
await novaConta('C6 Bank');
await novoLancamento('Luz', '18000');
await page.waitForTimeout(5000);
const antes = await naConta();
conferir('1. o servidor tem as duas contas e os dois lançamentos',
  antes.contas.length === 2 && antes.lancamentos.length === 2, JSON.stringify(antes));

// ---- a volta no tempo, com o envio quebrando no meio ----
//
// Deixo o GET passar (a cópia precisa ser baixada para ser restaurada) e
// derrubo tudo que escreve. É o celular com internet ruim: lê, não grava.
await ctx.route('**/rest/v1/**', (r) => {
  if (r.request().method() === 'GET') return r.continue();
  return r.abort();
});

await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
console.log('lista de cópias:', limpo(await page.textContent('#folha')).slice(0, 220));
await page.click('#folha .linha:has-text("Cópia feita por você")'); await page.waitForTimeout(1500);
console.log('caixa 1:', limpo(await page.textContent('#dialogoTitulo').catch(() => '(nenhuma)')),
  '|', limpo(await page.textContent('#dialogoAcoes').catch(() => '')));
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(12000);
const caixa2 = limpo(await page.textContent('#dialogoTexto').catch(() => ''));
console.log('caixa 2:', limpo(await page.textContent('#dialogoTitulo').catch(() => '(nenhuma)')),
  '|', caixa2.slice(0, 160));
if (await page.locator('#dialogoFundo.aberta').count()) {
  const bs = page.locator('#dialogoAcoes button');
  await bs.nth((await bs.count()) - 1).click(); await page.waitForTimeout(900);
}
await page.click('#cortina', { force: true }).catch(() => {}); await page.waitForTimeout(800);
conferir('2. com o envio falhando, o app NÃO promete que a nuvem recebeu',
  /ainda NÃO recebeu/.test(caixa2), caixa2.slice(0, 140));

// ---- e agora o app é recarregado, como numa atualização ----
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(6000);

// A internet volta inteira.
await ctx.unroute('**/rest/v1/**');
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(16000);

const depois = await naConta();
console.log('no servidor depois:', JSON.stringify(depois));
conferir('3. o servidor ficou só com o que a cópia tinha',
  depois.contas.length === 1 && depois.contas[0] === 'Banco Inter', JSON.stringify(depois.contas));
conferir('4. e só com o lançamento da cópia',
  depois.lancamentos.length === 1 && depois.lancamentos[0] === 'Aluguel',
  JSON.stringify(depois.lancamentos));

const naTela = await totalEmContas();
conferir('5. e a tela não voltou a somar as duas levas', naTela === '-R$ 320,00', naTela);
const contasNaTela = limpo(await page.textContent('#telaInicio').catch(() => ''));
conferir('6. nenhuma conta aparece duas vezes',
  (contasNaTela.match(/Banco Inter/g) || []).length === 1 &&
  (contasNaTela.match(/C6 Bank/g) || []).length === 0,
  'Banco Inter ×' + (contasNaTela.match(/Banco Inter/g) || []).length +
  ', C6 Bank ×' + (contasNaTela.match(/C6 Bank/g) || []).length);
await page.screenshot({ path: dir+'/z18-sem-uniao.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: a substituição continua substituição depois de falhar e recarregar');

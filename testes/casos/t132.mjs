// Reimportar extrato duplicava tudo o que o app tinha juntado como
// transferência.
//
// Vitor, 26/10/2026, com dois prints lado a lado: "tenta identificar o pq
// esse extrato não está sendo identificado como já lançado". Dois PIX de
// entrada vinham desmarcados, prontos para entrar de novo, com os mesmos
// lançamentos já na conta.
//
// A causa é o juntarUmPar(). Juntando a saída de uma conta com a entrada
// de outra, os dois viram UM lançamento do tipo 'transferencia', cujo
// contaId passa a ser o da conta de ORIGEM e cuja data passa a ser a da
// SAÍDA. Visto da conta de destino, isso quebrava a checagem de repetidos
// por três motivos ao mesmo tempo: tipo, conta e data.
//
// E o estrago crescia: quanto mais pares o app achasse, mais duplicatas
// cada reimportação criaria.
//
// Aqui: C6 manda para o Inter duas vezes. Uma no mesmo dia, outra com dois
// dias de diferença entre sair e cair. Junta os dois pares, reimporta o
// extrato do Inter, e nenhuma das duas linhas pode vir marcada para lançar.
import { chromium, dir, ENDERECO } from '../comum.mjs';
import fs from 'node:fs';

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

// O extrato do Inter: duas entradas que, na verdade, vieram do C6.
// A de 31/08 é a que saiu do C6 em 29/08 — é o caso do print dele.
const arquivo = dir + '/t132-inter-' + process.pid + '.csv';
fs.writeFileSync(arquivo,
  'Data;Descrição;Valor\r\n' +
  '27/08/2026;PIX TRANSF VITOR T27/08;211,00\r\n' +
  '31/08/2026;PIX TRANSF VITOR T29/08;541,40\r\n', 'utf8');

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
const email = 't132-' + Date.now() + '-' + process.pid + '@exemplo.com';
await c.nth(1).fill(email);
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Duas contas: C6 manda, Inter recebe.
for (const nome of ['C6 Bank', 'Banco Inter']) {
  await irParaInicio();
  await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
  await folha().locator('input.entrada[type=text]').first().fill(nome);
  await page.click('#folha .btn-ouro'); await page.waitForTimeout(1300);
}

// Sobe as contas antes: a semeadura precisa dos ids que estão no servidor.
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Sincronizar agora")'); await page.waitForTimeout(7000);
await semDialogo();

// Os quatro lançamentos soltos, pela API: é o estado de quem já importou
// os dois extratos. O que está em teste é o que vem DEPOIS de juntar.
const semeadura = await page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const cab = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token,
                'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const contas = await (await fetch(cfg.supabaseUrl + '/rest/v1/contas?select=id,nome', { headers: cab })).json();
  const c6 = contas.find((x) => /C6/.test(x.nome)).id;
  const inter = contas.find((x) => /Inter/.test(x.nome)).id;
  const m = pac.usuario.id.slice(0, 8);
  const base = { user_id: pac.usuario.id, categoria: 'Outros', subcategoria: '', importacao_id: '' };
  const linhas = [
    // Par 1: sai e cai no mesmo dia.
    Object.assign({ id: 'p1s-' + m, tipo: 'saida',   valor: 21100, descricao: 'Pix enviado para VITOR T', data: '2026-08-27', conta_id: c6 }, base),
    Object.assign({ id: 'p1e-' + m, tipo: 'entrada', valor: 21100, descricao: 'PIX TRANSF VITOR T27/08', data: '2026-08-27', conta_id: inter }, base),
    // Par 2: sai sábado 29, cai segunda 31. É o do print.
    Object.assign({ id: 'p2s-' + m, tipo: 'saida',   valor: 54140, descricao: 'Pix enviado para VITOR T', data: '2026-08-29', conta_id: c6 }, base),
    Object.assign({ id: 'p2e-' + m, tipo: 'entrada', valor: 54140, descricao: 'PIX TRANSF VITOR T29/08', data: '2026-08-31', conta_id: inter }, base)
  ];
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/lancamentos', {
    method: 'POST', headers: cab, body: JSON.stringify(linhas) });
  return r.status;
}, null);
console.log('semeadura ·', semeadura);

await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Sincronizar agora")'); await page.waitForTimeout(9000);
await semDialogo();

// ---- junta os dois pares pela tela, que é o caminho do Vitor ----
await irParaInicio(); await page.waitForTimeout(1200);
const noInicio = limpo(await page.textContent('#telaInicio'));
conferir('1. o app achou os dois pares de transferência',
  /Achei 2 saídas com o mesmo valor/.test(noInicio),
  (noInicio.match(/Achei [^.]*\./) || ['(não achei o cartão)'])[0]);
await page.screenshot({ path: dir+'/w01-pares-achados.png', fullPage: true });

await page.click('#telaInicio .cartao:has-text("Transferências entre contas") .btn-ouro');
await page.waitForTimeout(1500);
const botaoJuntar = limpo(await page.textContent('#folha .btn-ouro').catch(() => ''));
conferir('2. a folha oferece juntar as duas', /Juntar 2 transfer/.test(botaoJuntar), botaoJuntar);
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1500);
// O primeiro botão é "Confirmar"; semDialogo() clicaria em Cancelar.
const pergunta = limpo(await page.textContent('#dialogoTexto').catch(() => ''));
console.log('pergunta ao juntar:', pergunta.slice(0, 160));
await page.locator('#dialogoAcoes button').nth(0).click(); await page.waitForTimeout(4000);
await semDialogo();

const viraram = await page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl +
    '/rest/v1/lancamentos?select=tipo,valor,data,data_destino&excluido_em=is.null&order=valor.asc',
    { headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
  return await r.json();
});
console.log('no servidor:', JSON.stringify(viraram));

// ---- agora reimporta o extrato do Inter ----
page.on('filechooser', async (fc) => { await fc.setFiles(arquivo); });
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Importar extrato")'); await page.waitForTimeout(4000);

// A conta precisa ser o Inter, que é de quem é o extrato.
const seletor = folha().locator('select').first();
if (await seletor.count()) {
  await seletor.selectOption({ label: 'Banco Inter' }).catch(() => {});
  await page.waitForTimeout(1500);
}

const linhas = await page.locator('#folha .item-extrato').count();
const marcadas = await page.locator('#folha .caixinha.marcada').count();
const jaExiste = await page.locator('#folha .ja-tem').count();
const etiquetas = await page.$$eval('#folha .ja-tem', ns => ns.map(n => n.textContent.trim()));
console.log('etiquetas:', JSON.stringify(etiquetas));
await page.screenshot({ path: dir+'/w02-reimportando.png', fullPage: true });

conferir('3. o extrato do Inter voltou com as 2 linhas', linhas === 2, linhas + ' linha(s)');
conferir('4. as duas são reconhecidas como já lançadas (eram 0)',
  jaExiste === 2, jaExiste + ' de 2 marcadas como "já existe"');
conferir('5. e nenhuma vem marcada para entrar de novo',
  marcadas === 0, marcadas + ' marcada(s) para lançar');
conferir('6. casam pela regra comum, porque as pernas continuam inteiras',
  etiquetas.length === 2 && etiquetas.every((t) => /já existe/.test(t)),
  JSON.stringify(etiquetas));
// ---- segundo ato: o par juntado por versão ANTERIOR à 5.25.0 ----
//
// Até a 5.24.1, juntar apagava os dois lançamentos e criava um terceiro,
// do tipo 'transferencia', com a data da saída. São esses que estão na
// conta do Vitor — nove deles —, e é só para eles que existe o caminho
// de casamento por transferência.
//
// Aqui eu produzo exatamente essa forma antiga: apago as duas pernas do
// par de R$ 541,40 e ponho no lugar uma transferência só, de 29/08, sem
// data_destino. Depois entro de novo, para o aparelho baixar assim.
await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
await semDialogo();
const virouAntigo = await page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const cab = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token,
                'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const contas = await (await fetch(cfg.supabaseUrl + '/rest/v1/contas?select=id,nome', { headers: cab })).json();
  const c6 = contas.find((x) => /C6/.test(x.nome)).id;
  const inter = contas.find((x) => /Inter/.test(x.nome)).id;
  const m = pac.usuario.id.slice(0, 8);
  const fora = await fetch(cfg.supabaseUrl + '/rest/v1/lancamentos?valor=eq.54140',
    { method: 'DELETE', headers: cab });
  const dentro = await fetch(cfg.supabaseUrl + '/rest/v1/lancamentos', {
    method: 'POST', headers: cab, body: JSON.stringify([{
      id: 'velha-' + m, user_id: pac.usuario.id, tipo: 'transferencia', valor: 54140,
      descricao: 'Pix enviado para VITOR T', categoria: 'Transferência', subcategoria: '',
      importacao_id: '', data: '2026-08-29', conta_id: c6, conta_destino_id: inter
    }]) });
  return 'DELETE ' + fora.status + ' POST ' + dentro.status;
});
console.log('forma antiga posta no lugar ·', virouAntigo);

await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(2500);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-contorno:has-text("Entrar na minha conta")'); await page.waitForTimeout(1200);
const campos = page.locator('.ent-campo input');
await campos.nth(0).fill(email);
await campos.nth(1).fill('senha123');
await page.click('.btn-dourado:has-text("Entrar")'); await page.waitForTimeout(16000);
await semDialogo();

await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Importar extrato")'); await page.waitForTimeout(4000);
const seletor2 = folha().locator('select').first();
if (await seletor2.count()) {
  await seletor2.selectOption({ label: 'Banco Inter' }).catch(() => {});
  await page.waitForTimeout(1500);
}
const velhas = await page.$$eval('#folha .ja-tem', ns => ns.map(n => n.textContent.trim()));
const marcadas2 = await page.locator('#folha .caixinha.marcada').count();
console.log('etiquetas (forma antiga):', JSON.stringify(velhas));
conferir('7. transferência da forma antiga também é reconhecida',
  velhas.length === 2 && marcadas2 === 0, velhas.length + ' etiquetas · ' + marcadas2 + ' marcada(s)');
conferir('8. e a etiqueta diz de que dia é a transferência que casou',
  velhas.some((t) => /transferência de 29\/08\/2026/.test(t)), JSON.stringify(velhas));
await page.screenshot({ path: dir+'/w02-reimportando.png', fullPage: true });

await page.locator('#folha .etiqueta-dia').nth(1).click(); await page.waitForTimeout(1200);
const painel = limpo(await page.locator('#folha .dia-real').first().textContent().catch(() => ''));
console.log('painel 31/08:', painel.slice(0, 220));
conferir('9. abrindo o dia 31/08, o painel traz a transferência de 29/08',
  /Por perto, e é esta mesma linha/i.test(painel) && /29\/08\/2026/.test(painel),
  painel.slice(0, 140));
await page.screenshot({ path: dir+'/w03-por-perto.png', fullPage: true });

await browser.close();
try { fs.unlinkSync(arquivo); } catch (e) { /* já foi */ }
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: transferência juntada volta a ser reconhecida no extrato');

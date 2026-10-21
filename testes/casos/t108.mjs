// A volta no tempo: uma cópia por dia, na nuvem, por duas semanas.
//
// O backup sempre existiu, mas era um arquivo que alguém precisava
// lembrar de gerar — e ninguém lembra antes de precisar. Em outubro de
// 2026 um cofre trazido de outra conta somou com o que já estava na
// nuvem e as contas do Vitor dobraram de valor; o conserto daquilo está
// no t107, isto aqui é a rede embaixo.
//
// Pedido dele: "um backup automático 1 vez por dia por conta, guardado
// de até 2 semanas, e a pessoa só chega ali, escolhe a data de
// recuperação e recupera tudo na nuvem".
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('response', async (r) => {
  if (r.url().indexOf('/rest/v1/') < 0) return;
  if (r.status() < 300) return;
  let corpo = ''; try { corpo = (await r.text()).slice(0, 160); } catch (e) { corpo = ''; }
  console.log('REDE ' + r.status() + ' ' + r.request().method() + ' ' + r.url().replace(/^.*\/rest/, '/rest') + ' :: ' + corpo);
});

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
  for (let i = 0; i < 6; i++) {
    if (await page.locator('#telaInicio:visible').count()) return;
    await page.locator('#navegacao button').nth(0).click({ force: true }).catch(() => {});
    await page.waitForTimeout(700);
  }
};
const totalEmContas = async () => {
  await irParaInicio(); await page.waitForTimeout(900);
  // Ler o texto de uma tela escondida devolve o que ela desenhou da última
  // vez. Sem esta linha, "não cheguei no Início" vira "o número está velho".
  if (!(await page.locator('#telaInicio:visible').count())) return '(não cheguei no Início)';
  const t = limpo(await page.textContent('#telaInicio'));
  const m = t.match(/Total em contas\s*(−?-?R\$ [\d.,]+)/);
  return m ? m[1].replace('−', '-') : '(não achei)';
};
// O que está guardado na nuvem, lido direto do servidor.
const instantaneosNaNuvem = async () => page.evaluate(async () => {
  const pac = localStorage.getItem('caixa.nuvem.v3');
  if (!pac) return 'sem sessão';
  const tok = JSON.parse(pac).access_token;
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/instantaneos?select=*', {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok } });
  return (await r.json()).map((i) => ({ dia: i.dia, resumo: i.resumo, tamanho: i.tamanho, bytes: (i.dados || '').length }));
});

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t108-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// ---- o estado "bom": Banco Inter com −R$ 320,00 ----
await irParaInicio();
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(800);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1200);
await page.click('#fab'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '32000');
await folha().locator('input.entrada[type=text]').first().fill('Aluguel');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
const bom = await totalEmContas();
conferir('1. o estado bom é −R$ 320,00', bom === '-R$ 320,00', bom);

// A cópia do dia sai depois de uma sincronização completa.
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(9000);
const guardados = await instantaneosNaNuvem();
console.log('na nuvem:', JSON.stringify(guardados));
conferir('2. o app guardou sozinho uma cópia do dia',
  Array.isArray(guardados) && guardados.length === 1, JSON.stringify(guardados));
conferir('3. a cópia diz o que tem dentro',
  Array.isArray(guardados) && /1 lançamentos · 1 contas/.test(guardados[0].resumo),
  Array.isArray(guardados) ? guardados[0].resumo : '-');
conferir('4. e vai comprimida (menor que o JSON cru)',
  Array.isArray(guardados) && guardados[0].bytes < guardados[0].tamanho,
  Array.isArray(guardados) ? guardados[0].bytes + ' bytes de ' + guardados[0].tamanho : '-');

// ---- estraga: mais uma conta e mais um lançamento ----
await irParaInicio();
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(800);
await folha().locator('input.entrada[type=text]').first().fill('C6 Bank');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1200);
await page.click('#fab'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '55000');
await folha().locator('input.entrada[type=text]').first().fill('Besteira');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2500);
const estragado = await totalEmContas();
conferir('5. depois do estrago, −R$ 870,00', estragado === '-R$ 870,00', estragado);
await page.screenshot({ path: dir+'/v01-estragado.png', fullPage: true });

// ---- a pessoa chega ali, escolhe a data e volta ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1000);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
const naFolha = limpo(await page.textContent('#folha'));
console.log('folha:', naFolha.slice(0, 260));
conferir('6. a folha lista a cópia de hoje com o resumo',
  /hoje/.test(naFolha) && /1 lançamentos · 1 contas/.test(naFolha), naFolha.slice(0, 200));
await page.screenshot({ path: dir+'/v02-escolher-a-data.png', fullPage: true });

await page.click('#folha .linha:has-text("hoje")'); await page.waitForTimeout(1200);
const aviso = limpo(await page.textContent('#dialogoTexto'));
conferir('7. e avisa que o que veio depois se perde',
  /se perde/.test(aviso) && /nuvem/.test(aviso), aviso.slice(0, 140));
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(9000);
conferir('8. o app avisa que voltou', /voltaram ao que eram/.test(limpo(await page.textContent('#dialogoTexto').catch(() => ''))));
await page.locator('#dialogoAcoes button').nth(0).click({ force: true }).catch(() => {});
await page.waitForTimeout(2500);

const voltou = await totalEmContas();
conferir('9. voltou para −R$ 320,00', voltou === '-R$ 320,00', voltou);
const contasAgora = limpo(await page.textContent('#telaInicio'));
conferir('10. a conta que entrou depois sumiu', !/C6 Bank/.test(contasAgora),
  contasAgora.slice(contasAgora.indexOf('Contas'), contasAgora.indexOf('Contas') + 110));
await page.screenshot({ path: dir+'/v03-voltou.png', fullPage: true });

// ---- e a nuvem foi junto: é isso que o t107 garante ----
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(9000);
const depoisDeRecarregar = await totalEmContas();
conferir('11. recarregando, a nuvem devolve o estado bom',
  depoisDeRecarregar === '-R$ 320,00', depoisDeRecarregar);
const naNuvem = await page.evaluate(async () => {
  const tok = JSON.parse(localStorage.getItem('caixa.nuvem.v3')).access_token;
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/contas?select=nome&excluido_em=is.null', {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok } });
  return (await r.json()).map((x) => x.nome);
});
conferir('12. e no servidor só sobrou o Banco Inter',
  JSON.stringify(naNuvem) === JSON.stringify(['Banco Inter']), JSON.stringify(naNuvem));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: a cópia do dia sai sozinha e a volta funciona');

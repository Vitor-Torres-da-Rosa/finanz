// Antes de apagar, o app guarda uma cópia — e diz o que ia sair.
//
// Pedido do Vitor em 21/10/2026: "quando clicar em deletar o app deve
// criar um backup antes do último delete, já com a descrição do que foi
// pedido, mesmo que seja tudo ou que seja parte".
//
// A cópia vai para a mesma tabela da cópia diária, com o motivo contando
// o que estava prestes a sair: "antes de excluir o lançamento Aluguel, de
// R$ 320,00". Quem se arrepende acha pela frase, não pela hora.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('response', async (r) => {
  if (r.url().indexOf('/rest/v1/') < 0 || r.status() < 300) return;
  let b = ''; try { b = (await r.text()).slice(0, 150); } catch (e) { b = ''; }
  console.log('REDE ' + r.status() + ' ' + r.request().method() + ' ' + r.url().replace(/^.*\/rest/, '/rest') + ' :: ' + b);
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
const copiasNaNuvem = async () => page.evaluate(async () => {
  const pac = localStorage.getItem('caixa.nuvem.v4');
  if (!pac) return [];
  const tok = JSON.parse(pac).access_token;
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/instantaneos?select=dia,motivo,resumo', {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok } });
  return (await r.json()).map((i) => ({ motivo: i.motivo, resumo: i.resumo }));
});

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t111-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// ---- uma conta e dois lançamentos ----
await irParaInicio();
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1300);
for (const [valor, nome] of [['32000', 'Aluguel'], ['15000', 'Mercado']]) {
  await page.click('#fab'); await page.waitForTimeout(900);
  await porDinheiro(folha().locator('.valor-grande'), valor);
  await folha().locator('input.entrada[type=text]').first().fill(nome);
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1600);
}
const antes = await totalEmContas();
conferir('1. os dois lançamentos somam −R$ 470,00', antes === '-R$ 470,00', antes);
await page.waitForTimeout(6000);

// ---- apagar um lançamento ----
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1400);
await page.click('#telaTransacoes .linha:has-text("Aluguel")'); await page.waitForTimeout(1400);
await page.click('#folha .btn-perigo:has-text("Excluir lançamento")'); await page.waitForTimeout(1000);
const aviso = limpo(await page.textContent('#dialogoTitulo'));
conferir('2. pede confirmação antes de apagar', /Excluir este lançamento/.test(aviso), aviso);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(6000);
await page.screenshot({ path: dir+'/z01-depois-de-apagar.png', fullPage: true });

const depois = await totalEmContas();
conferir('3. o lançamento saiu: sobrou −R$ 150,00', depois === '-R$ 150,00', depois);

// ---- a cópia de antes está na nuvem, com a frase do que ia sair ----
const copias = await copiasNaNuvem();
console.log('cópias:', JSON.stringify(copias));
const deExclusao = copias.filter((i) => i.motivo && i.motivo !== 'dia');
conferir('4. o app guardou uma cópia antes de apagar',
  deExclusao.length === 1, JSON.stringify(copias));
conferir('5. e a frase diz o que ia sair, com o valor',
  deExclusao.length === 1 && /antes de excluir o lançamento Aluguel, de R\$.320,00/.test(deExclusao[0].motivo),
  deExclusao.length ? deExclusao[0].motivo : '-');
conferir('6. a cópia é do estado de ANTES: dois lançamentos',
  deExclusao.length === 1 && /2 lançamentos/.test(deExclusao[0].resumo),
  deExclusao.length ? deExclusao[0].resumo : '-');

// ---- e dá para voltar por ela ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1000);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
const naFolha = limpo(await page.textContent('#folha'));
console.log('folha:', naFolha.slice(0, 300));
conferir('7. a folha mostra a cópia pela frase, não só pela data',
  /Antes de excluir o lançamento Aluguel/.test(naFolha), naFolha.slice(0, 220));
await page.screenshot({ path: dir+'/z02-lista-com-exclusao.png', fullPage: true });

await page.click('#folha .linha:has-text("Antes de excluir o lançamento Aluguel")'); await page.waitForTimeout(1400);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(12000);
await page.locator('#dialogoAcoes button').nth(0).click({ force: true }).catch(() => {});
await page.waitForTimeout(2500);

const voltou = await totalEmContas();
conferir('8. voltando por ela, o lançamento apagado está de volta',
  voltou === '-R$ 470,00', voltou);
await page.screenshot({ path: dir+'/z03-desfeito.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: apagar guarda uma cópia antes, e dá para desfazer por ela');

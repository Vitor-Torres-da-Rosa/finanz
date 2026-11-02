// O que está só no aparelho não pode sumir quando a nuvem manda a dela.
//
// 02/11/2026: o Vitor cadastrou doces e corridas enquanto a tabela do
// Uber e dos Doces ainda não existia no servidor (o app guardava só no
// aparelho, de propósito). Rodada a migração, a tabela apareceu vazia; na
// sincronização seguinte o servidor tinha novidade (o carimbo mudou), o
// app adotou a versão de lá — e a lista vazia entrou no lugar da daqui.
// "Não tá salvando": o produto que ele tinha cadastrado tinha sumido.
import { chromium, dir, ENDERECO, irParaClientes } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
let page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const dinheiro = async (rotulo, digitos) => {
  const c = folha().getByLabel(rotulo, { exact: true });
  await c.click(); for (let i = 0; i < 12; i++) await c.press('Backspace');
  await c.type(digitos); await page.waitForTimeout(150);
};

// A tabela "não existe" no servidor, como antes da migração.
const semTabela = (r) => r.fulfill({ status: 404, contentType: 'application/json',
  body: JSON.stringify({ code: 'PGRST205', message: "Could not find the table 'public.empreendedor_registros' in the schema cache" }) });
await ctx.route('**/rest/v1/empreendedor_registros**', semTabela);

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t149-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Produto cadastrado com a tabela faltando: fica só no aparelho.
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900);
await page.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await page.waitForTimeout(600);
await page.click('#telaInicio button:has-text("+ Novo produto")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome do doce').fill('Pote de vidro');
await dinheiro('Valor de venda ao cliente final', '2500');
await dinheiro('Repasse para mim', '600');
await page.click('#folha .btn-ouro:has-text("Salvar produto")'); await page.waitForTimeout(1200);
// Sincroniza com a tabela faltando: o resto sobe, o produto fica aqui.
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(5000);
conferir('1. o produto está na tela', /Pote de vidro/.test(limpo(await page.textContent('#telaInicio'))));

// A migração roda: a tabela passa a existir, vazia.
await ctx.unroute('**/rest/v1/empreendedor_registros**', semTabela);
// Outro aparelho mexe na conta: o carimbo do servidor muda.
await page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  await fetch(cfg.supabaseUrl + '/rest/v1/clientes', { method: 'POST',
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token,
               'Content-Type': 'application/json', Prefer: 'return=minimal' },
    body: JSON.stringify([{ id: 'cli-t149-' + Date.now(), user_id: pac.usuario.id, nome: 'Cliente do outro aparelho' }]) });
});
// Abre o app de novo: a sincronização encontra novidade lá.
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(6000);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")').catch(() => {}); await page.waitForTimeout(800);
if (!(await page.locator('#telaInicio .modulo-cabecalho').count())) { await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900); }
await page.click('#telaInicio .abas-modulo button:has-text("Produtos")').catch(() => {}); await page.waitForTimeout(800);
conferir('2. depois de trazer a versão da nuvem, o produto continua', /Pote de vidro/.test(limpo(await page.textContent('#telaInicio'))),
  limpo(await page.textContent('#telaInicio')).slice(0, 160));

// E ele sobe na sincronização seguinte.
let noServidor = false;
for (let i = 0; i < 20 && !noServidor; i++) {
  noServidor = await page.evaluate(async () => {
    const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
    const cfg = window.FINANZ_CONFIG;
    const r = await fetch(cfg.supabaseUrl + '/rest/v1/empreendedor_registros?select=*', {
      headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
    const linhas = await r.json();
    return Array.isArray(linhas) && linhas.some(l => l.dados && l.dados.nome === 'Pote de vidro');
  });
  if (!noServidor) await page.waitForTimeout(1000);
}
conferir('3. e sobe para a nuvem', noServidor);
const clientes = await page.evaluate(() => { try { return localStorage.getItem('caixa.nuvem.v4') ? 1 : 0; } catch (e) { return 0; } });
await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: o que está só no aparelho não some');

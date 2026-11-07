// Recuperar das cópias o que a troca pela lista vazia apagou.
//
// Conserto de uma vez só para o que sumiu em 02/11/2026: o app procura nas
// cópias automáticas mais recentes o Uber e os Doces que não estão nem no
// aparelho nem no servidor e devolve.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t150-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(4000);

// Uma cópia (de antes do estrago) com uma vendedora, um produto e uma
// corrida; e um produto que foi apagado de propósito (está no servidor
// como apagado), que não pode voltar.
const suf = Date.now().toString(36);
await page.evaluate(async (suf) => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const h = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token, 'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const copia = {
    contas: [], lancamentos: [], clientes: [], servicos: [], pagamentos: [], parcelas: [], metas: [], ativos: [],
    doceVendedores: [{ id: 'v-' + suf, nome: 'Daniela', telefone: '', obs: '', ativo: true, criadoEm: Date.now() }],
    doceProdutos: [{ id: 'p-' + suf, nome: 'Brigadeiro', repasse: 200, preco: 400, custo: 100, ativo: true, criadoEm: Date.now() },
                   { id: 'apagado-' + suf, nome: 'Bolo apagado', repasse: 500, preco: 900, custo: 0, ativo: true, criadoEm: Date.now() }],
    doceEntregas: [], doceAcertos: [], docePagamentos: [], uberJornadas: [],
    uberRegistros: [{ id: 'u-' + suf, tipo: 'corrida', data: new Date().toISOString().slice(0, 10), hora: '10:00', valor: 5000, km: 10,
                      plataforma: 'Particular', descricao: 'Aristeuzinho', criadoEm: Date.now() }]
  };
  const texto = JSON.stringify(copia);
  const b64 = btoa(unescape(encodeURIComponent(texto)));
  await fetch(cfg.supabaseUrl + '/rest/v1/instantaneos', { method: 'POST', headers: h,
    body: JSON.stringify([{ id: 'inst-' + suf, user_id: pac.usuario.id, dia: new Date().toISOString().slice(0, 10),
      motivo: 'alteração', resumo: 'teste', dados: b64, tamanho: texto.length }]) });
  await fetch(cfg.supabaseUrl + '/rest/v1/empreendedor_registros', { method: 'POST', headers: h,
    body: JSON.stringify([{ id: 'apagado-' + suf, user_id: pac.usuario.id, tipo: 'doce_produto',
      dados: { nome: 'Bolo apagado' }, excluido_em: new Date().toISOString() }]) });
  localStorage.removeItem('finanz.recuperouModulos.v1');
}, suf);

await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(9000);
// Conta sem nada: o app oferece voltar à cópia inteira. Aqui não.
await page.click('#dialogoAcoes button:has-text("Agora não")').catch(() => {}); await page.waitForTimeout(3000);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")').catch(() => {}); await page.waitForTimeout(800);
await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900);
await page.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await page.waitForTimeout(700);
const produtos = limpo(await page.textContent('#telaInicio'));
conferir('1. o produto que tinha sumido voltou', /Brigadeiro/.test(produtos), produtos.slice(0, 160));
conferir('2. o que foi apagado de propósito não volta', !/Bolo apagado/.test(produtos));
await page.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await page.waitForTimeout(700);
conferir('3. a vendedora voltou', /Daniela/.test(limpo(await page.textContent('#telaInicio'))));
await page.click('#telaInicio .modulo-voltar'); await page.waitForTimeout(700);
await page.click('#telaInicio [data-modulo="uber"]'); await page.waitForTimeout(900);
await page.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await page.waitForTimeout(800);
conferir('4. a corrida voltou', /R\$ 50,00/.test(limpo(await page.textContent('#telaInicio'))));
const vez = await page.evaluate(() => !!localStorage.getItem('finanz.recuperouModulos.v1'));
conferir('5. o conserto roda uma vez só', vez);

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: recuperação das cópias');

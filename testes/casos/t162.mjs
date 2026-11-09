// Sócio que também vende e a lixeira do vendedor (pedidos do Vitor em
// 08/11/2026).
//
// - Na edição do membro dá para marcar "Sim, é vendedor(a)". Marcado, o
//   nome aparece em Entregas como qualquer vendedor e fica sempre na
//   Prestação, mesmo sem doces, abrindo direto no acerto sem estoque.
// - Desmarcando, ele sai das duas listas.
// - Em Entregas, tocando num vendedor, tem uma lixeira no canto que exclui.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const tela = async () => limpo(await page.textContent('#telaInicio'));
const fechar = async () => {
  for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
};
const aba = async (nome) => { await page.click('#telaInicio .abas-modulo button:has-text("' + nome + '")'); await page.waitForTimeout(800); };

await page.clock.setFixedTime(new Date(2026, 10, 8, 15, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t162-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

const seg = page.locator('#telaInicio .segmentos button:has-text("Empreendedor")');
if (await seg.count()) { await seg.first().click(); await page.waitForTimeout(800); }
await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900);

// ---- um produto, para a prestação ter o que escolher ----
await aba('Produtos');
await page.click('#telaInicio button:has-text("+ Novo produto")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome do doce').fill('Brigadeiro');
const dinheiro = async (loc, digitos) => {
  await loc.click(); for (let i = 0; i < 14; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(200);
};
await dinheiro(folha().getByLabel('Valor de compra do produto', { exact: true }), '100');
await dinheiro(folha().getByLabel('Valor de venda ao cliente final', { exact: true }), '400');
await dinheiro(folha().getByLabel('Repasse para o revendedor', { exact: true }), '200');
await page.click('#folha .btn-ouro:has-text("Salvar produto")'); await page.waitForTimeout(900);
await fechar();

// ---- a sócia que também vende ----
await aba('Resumo');
await page.click('#telaInicio button:has-text("+ Membro")'); await page.waitForTimeout(800);
const formTxt = limpo(await folha().textContent());
conferir('1. o membro tem a opção de também vender', /Também vende os doces\?\s*Não\s*Sim, é vendedor\(a\)/.test(formTxt), formTxt.slice(0, 300));
await folha().getByLabel('Nome').fill('Vitória');
await folha().getByLabel('Parte do lucro (%)').fill('50');
await page.click('#folha button:has-text("Sim, é vendedor(a)")'); await page.waitForTimeout(300);
await page.click('#folha .btn-ouro:has-text("Salvar membro")'); await page.waitForTimeout(900);
await fechar();

await aba('Entregas');
conferir('2. ela aparece em Entregas como vendedora', await page.locator('#telaInicio .cartao-vendedor-entregas:has-text("Vitória")').count() === 1, await tela());
await aba('Prestação');
const pr = await tela();
conferir('3. e fica na Prestação mesmo sem doces, como sócia que vende direto', /Vitória\s*sócio\(a\) · vende direto/.test(pr), pr.slice(0, 300));
await page.screenshot({ path: dir + '/z64-socia-na-prestacao.png' });
await page.click('#telaInicio .linha:has-text("Vitória")'); await page.waitForTimeout(900);
const pc = limpo(await folha().textContent());
conferir('4. tocando, abre a prestação já sem estoque', /Prestação · Vitória/.test(await page.textContent('#folhaTitulo')) &&
  (await page.locator('#folha [aria-selected="true"]:has-text("Sem estoque")').count()) === 1 && /Brigadeiro/.test(pc), pc.slice(0, 200));
await fechar();

// ---- desmarcando, ela sai das duas listas ----
await aba('Resumo');
await page.click('#telaInicio .linha:has-text("Vitória")'); await page.waitForTimeout(900);
conferir('5. a edição mostra a opção marcada', (await page.locator('#folha [aria-selected="true"]:has-text("Sim, é vendedor(a)")').count()) === 1);
await page.click('#folha button:has-text("Não")'); await page.waitForTimeout(300);
await page.click('#folha .btn-ouro:has-text("Salvar membro")'); await page.waitForTimeout(900);
await fechar();
await aba('Prestação');
conferir('6. desmarcando, sai da Prestação', !/Vitória/.test((await tela()).split('Acertos e pagamentos')[0]));
await aba('Entregas');
conferir('7. e de Entregas', !(await page.locator('#telaInicio .cartao-vendedor-entregas:has-text("Vitória")').count()));

// ---- a lixeira do vendedor ----
await page.click('#telaInicio button:has-text("+ Adicionar vendedor")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome', { exact: true }).fill('Carlos');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(900);
await fechar();
await page.click('#telaInicio .cartao-vendedor-entregas:has-text("Carlos")'); await page.waitForTimeout(900);
conferir('8. a folha do vendedor tem a lixeira no canto', await page.locator('#folha .folha-titulo .titulo-lixeira').count() === 1);
await page.screenshot({ path: dir + '/z65-lixeira-vendedor.png' });
await page.click('#folha .titulo-lixeira'); await page.waitForTimeout(700);
const dlg = limpo(await page.textContent('#dialogoAcoes').catch(() => '')) + ' ' + limpo(await page.locator('.dialogo, #dialogo').first().textContent().catch(() => ''));
await page.click('#dialogoAcoes button:has-text("Excluir")'); await page.waitForTimeout(1000);
conferir('9. pergunta e exclui', /Excluir/.test(dlg) && !(await page.locator('#telaInicio .cartao-vendedor-entregas:has-text("Carlos")').count()), dlg.slice(0, 120));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

// Compra de vários doces com um valor só (pedido do Vitor em 08/11/2026):
// marca 10 temperos, 10 doces de vidro e 10 potes, paga um total, e o app
// divide entre eles — pelo valor de compra de cada um quando todos têm,
// senão por unidade.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const tela = async () => limpo(await page.textContent('#telaInicio'));
const dinheiro = async (loc, digitos) => { await loc.click(); for (let i = 0; i < 14; i++) await loc.press('Backspace'); await loc.type(digitos); await page.waitForTimeout(150); };

await page.clock.setFixedTime(new Date(2026, 10, 8, 15, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t160-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Três doces com valor de compra: tempero R$ 1,00, doce de vidro R$ 3,00, pote R$ 2,00.
await page.evaluate(() => new Promise(res => {
  const s = Math.random().toString(36).slice(2);
  const dados = { contas: [{ id: 'cc' + s, nome: 'Banco', tipo: 'Conta corrente', saldoInicial: 0 }], lancamentos: [],
    doceProdutos: [{ id: 'pt' + s, nome: 'Tempero', preco: 500, repasse: 300, custo: 100 },
                   { id: 'pv' + s, nome: 'Doce de vidro', preco: 1000, repasse: 600, custo: 300 },
                   { id: 'pp' + s, nome: 'Pote', preco: 800, repasse: 500, custo: 200 }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(900);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900);
await page.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await page.waitForTimeout(600);
await page.click('#telaInicio .sub-produtos button:has-text("Fornecedor")'); await page.waitForTimeout(700);

await page.click('#telaInicio button:has-text("+ Nova compra")'); await page.waitForTimeout(800);
const itens = await page.$$eval('#folha .item-compra strong', ns => ns.map(n => n.textContent));
conferir('1. a compra lista todos os doces cadastrados', itens.length === 3 && itens.includes('Tempero') && itens.includes('Pote'), itens.join(', '));
await dinheiro(folha().locator('.valor-grande'), '6600');
const faltas = [];
for (const nome of ['Tempero', 'Doce de vidro', 'Pote']) {
  await folha().locator('.item-compra:has-text("' + nome + '") .contador-campo').fill('10'); await page.waitForTimeout(150);
  faltas.push(limpo(await folha().locator('.falta-compra').textContent()));
}
// 08/11/2026: ao lado do total, quanto ainda falta conforme marca os doces.
conferir('1b. conforme marca os doces, mostra quanto ainda falta do valor pago',
  /Doces marcados: R\$ 10,00\s*faltam R\$ 56,00/.test(faltas[0]) && /Doces marcados: R\$ 40,00\s*faltam R\$ 26,00/.test(faltas[1]) &&
  /Doces marcados: R\$ 60,00\s*faltam R\$ 6,00/.test(faltas[2]), faltas.join(' | '));
await folha().getByLabel('Fornecedor (opcional)').fill('Paulo fornecedor');
const prev = limpo(await folha().textContent());
// Pelo valor de compra, os doces somam 10 + 30 + 20 = R$ 60,00; os R$ 6,00
// que passam disso viram taxa da compra (08/11/2026).
conferir('2. cada doce entra pelo valor de compra, e a diferença vira taxa',
  /Tempero.*10 × R\$ 1,00 = R\$ 10,00/.test(prev) && /Doce de vidro.*10 × R\$ 3,00 = R\$ 30,00/.test(prev) &&
  /Pote.*10 × R\$ 2,00 = R\$ 20,00/.test(prev) && /3 doce\(s\) · 30 un\.\s*R\$ 60,00/.test(prev) &&
  /Os doces somam R\$ 60,00 pelo valor de compra\. A diferença de R\$ 6,00 entra como taxa da compra no custo operacional/.test(prev), prev.slice(0, 700));
await page.screenshot({ path: dir + '/z76-compra-varios.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Registrar compra")'); await page.waitForTimeout(1000);
let t = await tela();
conferir('3. na lista, uma compra só com o total pago e a taxa', /3 doces · 30 un\.\s*08\/11\/2026 · Paulo fornecedor · [^−]*Tempero[^−]*taxa R\$ 6,00\s*− R\$ 66,00/.test(t) &&
  /Gasto em compras\s*R\$ 60,00/.test(t) && /Mais R\$ 6,00 de taxas das compras, no custo operacional/.test(t), t.slice(0, 500));
conferir('4. e cada doce entra no seu estoque', /Tempero\s*com você agora\s*10 un\./.test(t) && /Doce de vidro\s*com você agora\s*10 un\./.test(t) && /Pote\s*com você agora\s*10 un\./.test(t));

// A taxa está no custo operacional do Resumo.
await page.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await page.waitForTimeout(700);
t = await tela();
conferir('3b. no Resumo, custo total = R$ 60,00 de mercadoria + R$ 6,00 de taxa', /Custo total\s*R\$ 66,00/.test(t), (t.match(/Custo total.{0,40}/) || [''])[0]);
await page.click('#telaInicio .resumo-linha-doces:has-text("Custo total")'); await page.waitForTimeout(800);
const ct = limpo(await folha().textContent());
conferir('3c. abrindo, a taxa aparece nos custos operacionais', /Custo operacional\s*R\$ 6,00/.test(ct) && /Taxa da compra · Paulo fornecedor/.test(ct), ct.slice(0, 400));
for (let i = 0; i < 3 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
await page.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await page.waitForTimeout(600);
await page.click('#telaInicio .sub-produtos button:has-text("Fornecedor")'); await page.waitForTimeout(700);

// ---- editar: tirar o pote ----
await page.click('#telaInicio .linha:has-text("3 doces")'); await page.waitForTimeout(800);
const q = await folha().locator('.item-compra:has-text("Pote") .contador-campo').inputValue();
conferir('5. editando, as quantidades voltam', q === '10', q);
await folha().locator('.item-compra:has-text("Pote") .contador-campo').fill('0'); await page.waitForTimeout(150);
await dinheiro(folha().locator('.valor-grande'), '4400');
await page.click('#folha .btn-ouro:has-text("Salvar compra")'); await page.waitForTimeout(1000);
t = await tela();
// Sem o pote, os doces somam R$ 40,00: a taxa passa a ser R$ 4,00.
conferir('6. o doce que saiu deixa a compra, e a taxa se refaz', /2 doces · 20 un\..*taxa R\$ 4,00\s*− R\$ 44,00/.test(t) && !/Pote\s*com você agora\s*10 un/.test(t), t.slice(0, 500));

// ---- excluir apaga a compra inteira ----
await page.click('#telaInicio .linha:has-text("2 doces")'); await page.waitForTimeout(800);
await page.click('#folha button:has-text("Excluir compra")'); await page.waitForTimeout(500);
await page.click('#dialogoAcoes button:has-text("Excluir")'); await page.waitForTimeout(1000);
t = await tela();
conferir('7. excluindo, sai a compra toda, com a taxa', /Nenhuma compra ainda/.test(t) && /Gasto em compras\s*R\$ 0,00/.test(t) && !/de taxas das compras/.test(t), t.slice(0, 300));

// ---- passando do valor pago: nada se divide, e o app pergunta ----
await page.click('#telaInicio button:has-text("+ Nova compra")'); await page.waitForTimeout(800);
await dinheiro(folha().locator('.valor-grande'), '5000');
await folha().locator('.item-compra:has-text("Tempero") .contador-campo').fill('100'); await page.waitForTimeout(200);
const pas = limpo(await folha().textContent());
conferir('8. passando do valor pago, mostra quanto passou e não divide', /Doces marcados: R\$ 100,00\s*passou R\$ 50,00/.test(pas) && /100 × R\$ 1,00 = R\$ 100,00/.test(pas), pas.slice(0, 300));
await page.click('#folha .btn-ouro:has-text("Registrar compra")'); await page.waitForTimeout(600);
conferir('9. e pergunta antes de salvar', /Os doces passam do valor pago/.test(await page.textContent('#dialogoTitulo')));
await page.click('#dialogoAcoes button:has-text("Conferir")'); await page.waitForTimeout(500);
conferir('10. "Conferir" volta para a compra', /Nova compra/.test(await page.textContent('#folhaTitulo')));

console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\ntudo certo: compra de vários doces');
await browser.close();
process.exit(falhas ? 1 : 0);

// Venda de Doces: a aba Resumo (pedido do Vitor em 07/11/2026).
//
// Primeiro o "Meu lucro" (a parte dele no lucro da operação); depois o
// total do mês em %: venda total, lucro dos revendedores (não é despesa),
// custo total (compras do fornecedor + custo operacional) e lucro da
// operação; os membros da empresa com a parte de cada um; e os vendedores
// por último, com o "+ Novo vendedor" embaixo.
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
const fechar = async () => { for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); } };

await page.clock.setFixedTime(new Date(2026, 10, 7, 15, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const email = 't159-' + Date.now() + '-' + process.pid + '@exemplo.com';
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill(email); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Novembro: Dani vendeu 10 brigadeiros (R$ 10,00, repasse R$ 7,00) e
// 4 bolos (R$ 20,00, repasse R$ 15,00); Mirian, 6 brigadeiros. Compras do
// mês: R$ 60,00. Venda total 10×10 + 4×20 + 6×10 = 240; revendedores
// 30 + 20 + 18 = 68; repasses 172.
await page.evaluate(() => new Promise(res => {
  const s = Math.random().toString(36).slice(2);
  const dados = { contas: [{ id: 'cc' + s, nome: 'Banco', tipo: 'Conta corrente', saldoInicial: 0 }], lancamentos: [],
    doceVendedores: [{ id: 'vd' + s, nome: 'Dani' }, { id: 'vm' + s, nome: 'Mirian' }],
    doceProdutos: [{ id: 'pb' + s, nome: 'Brigadeiro', preco: 1000, repasse: 700, custo: 200 }, { id: 'pk' + s, nome: 'Bolo de pote', preco: 2000, repasse: 1500, custo: 600 }],
    doceEntregas: [{ id: 'e1' + s, vendedorId: 'vd' + s, produtoId: 'pb' + s, data: '2026-11-02', quantidade: 20, repasse: 700, preco: 1000 },
                   { id: 'e2' + s, vendedorId: 'vd' + s, produtoId: 'pk' + s, data: '2026-11-02', quantidade: 5, repasse: 1500, preco: 2000 },
                   { id: 'e3' + s, vendedorId: 'vm' + s, produtoId: 'pb' + s, data: '2026-11-03', quantidade: 10, repasse: 700, preco: 1000 }],
    doceAcertos: [{ id: 'a1' + s, vendedorId: 'vd' + s, data: '2026-11-05', itens: [
                     { produtoId: 'pb' + s, vendidos: 10, devolvidos: 0, perdidos: 0, repasse: 700, preco: 1000, custo: 200 },
                     { produtoId: 'pk' + s, vendidos: 4, devolvidos: 0, perdidos: 0, repasse: 1500, preco: 2000, custo: 600 }] },
                  { id: 'a2' + s, vendedorId: 'vm' + s, data: '2026-11-06', itens: [
                     { produtoId: 'pb' + s, vendidos: 6, devolvidos: 0, perdidos: 0, repasse: 700, preco: 1000, custo: 200 }] }],
    doceCompras: [{ id: 'c1' + s, produtoId: 'pb' + s, quantidade: 30, valor: 6000, data: '2026-11-01' }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(900);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900);

let t = await tela();
conferir('1. a primeira aba é o Resumo, e o "+" redondo não aparece',
  /Resumo\s*Entregas\s*Prestação\s*Produtos/.test(t) && await page.$eval('#fab', b => b.classList.contains('fab-oculto')), t.slice(0, 120));
conferir('2. primeiro o "Meu lucro"; os vendedores e o "+ Novo vendedor" no fim',
  t.indexOf('Meu lucro') < t.indexOf('Total de novembro') && t.indexOf('Total de novembro') < t.lastIndexOf('Vendedores') && t.lastIndexOf('Vendedores') < t.indexOf('Mirian') &&
  t.lastIndexOf('+ Novo vendedor') > t.indexOf('Mirian'), t.slice(0, 200));
// custo 60; lucro 172 − 60 = 112.
conferir('3. o total do mês em %', /Venda total\s*R\$ 240,00\s*100,0%/.test(t) && /Lucro dos revendedores\s*R\$ 68,00\s*28,3%/.test(t) &&
  /Custo total\s*R\$ 60,00\s*25,0%/.test(t) && /Lucro da operação\s*R\$ 112,00\s*46,7%/.test(t), (t.match(/Total de novembro.{0,300}/) || [''])[0]);
conferir('4. o lucro dos revendedores fica numa cor neutra', await page.locator('#telaInicio .resumo-linha-doces .rl-valor.neutro').count() === 1);

// ---- custo operacional ----
await page.click('#telaInicio button:has-text("+ Custo operacional")'); await page.waitForTimeout(800);
await dinheiro(folha().locator('.valor-grande'), '4000');
await folha().getByLabel('O que foi').fill('Embalagens');
await page.click('#folha .btn-ouro:has-text("Salvar custo")'); await page.waitForTimeout(900);
t = await tela();
conferir('5. o custo operacional entra no custo total', /Custo total\s*R\$ 100,00\s*41,7%/.test(t) && /Lucro da operação\s*R\$ 72,00\s*30,0%/.test(t), (t.match(/Custo total.{0,80}/) || [''])[0]);
await page.click('#telaInicio .resumo-linha-doces:has-text("Custo total")'); await page.waitForTimeout(900);
let f = limpo(await folha().textContent());
conferir('6. tocando no custo total, os dois custos com a parte de cada um',
  /Mercadoria \(compras do fornecedor\)\s*R\$ 60,00\s*60,0%/.test(f) && /Custo operacional\s*R\$ 40,00\s*40,0%/.test(f) && /Embalagens/.test(f), f.slice(0, 400));
await page.screenshot({ path: dir + '/z74-custo-total.png' });
await fechar();

// ---- top 3 ----
await page.click('#telaInicio .resumo-linha-doces:has-text("Lucro dos revendedores")'); await page.waitForTimeout(900);
f = limpo(await folha().textContent());
conferir('7. tocando no lucro dos revendedores, o top 3 dos mais vendidos', /Top 3 de todas as vendas\s*1º · Brigadeiro.*80,0% de tudo o que foi vendido\s*16 un\..*2º · Bolo de pote.*4 un\./.test(f), f.slice(0, 400));
await fechar();

// ---- membros e a divisão do lucro ----
await page.click('#telaInicio button:has-text("+ Membro")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome').fill('Vitor');
await folha().getByLabel('E-mail').fill(email);
await folha().getByLabel('Função').fill('produção e compras');
await folha().getByLabel('Parte do lucro (%)').fill('50');
await page.click('#folha .btn-ouro:has-text("Salvar membro")'); await page.waitForTimeout(900);
await page.click('#telaInicio button:has-text("+ Membro")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome').fill('Vitória');
await folha().getByLabel('E-mail').fill('vitoria@exemplo.com');
await page.click('#folha .chip:has-text("Sócio(a)"), #folha button:has-text("Sócio(a)")').catch(() => {});
await folha().getByLabel('Função').fill('vendas');
await folha().getByLabel('Parte do lucro (%)').fill('60');
await page.click('#folha .btn-ouro:has-text("Salvar membro")'); await page.waitForTimeout(700);
conferir('8. a soma das partes não passa de 100%', /a soma passa de 100%/.test(limpo(await folha().textContent())));
await folha().getByLabel('Parte do lucro (%)').fill('50');
await page.click('#folha .btn-ouro:has-text("Salvar membro")'); await page.waitForTimeout(900);
t = await tela();
conferir('9. "Meu lucro" mostra só a minha parte: 50% de R$ 72,00', /Meu lucro · novembro\s*R\$ 36,00\s*Sua parte: 50,0% do lucro da operação \(R\$ 72,00\)/.test(t), t.slice(0, 260));
conferir('10. os membros com a parte de cada um', /Membros da empresa\s*V?Vitor \(você\)\s*Sócio\(a\) · produção e compras\s*R\$ 36,00\s*50,0%\s*V?Vitória\s*Sócio\(a\) · vendas\s*R\$ 36,00\s*50,0%/.test(t), (t.match(/Membros da empresa.{0,200}/) || [''])[0]);
await page.screenshot({ path: dir + '/z73-resumo-doces.png', fullPage: true });
await page.click('#telaInicio .cartao-meu-lucro'); await page.waitForTimeout(900);
f = limpo(await folha().textContent());
conferir('11. tocando no meu lucro, o lucro total da empresa e a divisão', /Lucro da empresa · novembro/.test(await page.textContent('#folhaTitulo')) &&
  /Lucro da operação\s*R\$ 72,00/.test(f) && /Divisão entre os membros\s*V?Vitor \(você\).*Vitória/.test(f), f.slice(0, 300));
await fechar();

// ---- recarregar mantém tudo ----
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3500);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")').catch(() => {}); await page.waitForTimeout(800);
if (!(await page.locator('#telaInicio .modulo-cabecalho').count())) { await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900); }
t = await tela();
conferir('12. recarregando, custos e membros continuam', /Custo total\s*R\$ 100,00/.test(t) && /Vitória/.test(t) && /Meu lucro · novembro\s*R\$ 36,00/.test(t));

console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\ntudo certo: resumo da venda de doces');
await browser.close();
process.exit(falhas ? 1 : 0);

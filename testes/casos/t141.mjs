// Distribuição de Doces, com o exemplo do Vitor (01/11/2026):
// entrego 50 doces com repasse de R$ 2,00 e venda a R$ 4,00; ele vende
// 35, devolve 10 e fica com 5. Tem de me repassar R$ 70,00, lucrou
// R$ 70,00 e ainda tem 5 doces. Depois, pagamento parcial e o resto.
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
const folha = () => page.locator('#folha');
const dinheiro = async (rotulo, digitos) => {
  const c = folha().getByLabel(rotulo, { exact: true });
  await c.click(); for (let i = 0; i < 12; i++) await c.press('Backspace');
  await c.type(digitos); await page.waitForTimeout(150);
};
const doServidor = async (ate) => {
  let linhas = [];
  for (let i = 0; i < 20; i++) {
    linhas = await page.evaluate(async () => {
      const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
      const cfg = window.FINANZ_CONFIG;
      const r = await fetch(cfg.supabaseUrl + '/rest/v1/empreendedor_registros?select=*', {
        headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
      return r.json();
    });
    linhas = (Array.isArray(linhas) ? linhas : []).filter(l => !l.excluido_em);
    if (ate(linhas)) return linhas;
    await page.waitForTimeout(1000);
  }
  return linhas;
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t141-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// ---- a entrada do Empreendedor ----
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
const modulos = await page.$$eval('#telaInicio .modulo-cartao .modulo-titulo', ns => ns.map(n => n.textContent));
// Pedido de 02/11/2026: o quadro "Painel geral" saiu (repetia o resumo), o
// resumo é a primeira coisa da tela e Distribuição virou Venda de Doces.
conferir('1. o Empreendedor mostra os três módulos, sem o quadro do painel',
  modulos.join('|') === 'Serviços e Vendas|Uber e Corridas|Venda de Doces', modulos.join(' | '));
conferir('2. e o resumo do mês vem primeiro, antes dos módulos', await page.evaluate(() => {
  const r = document.querySelector('#telaInicio .cartao-resumo-emp');
  const l = document.querySelector('#telaInicio .modulos-lista');
  return !!r && !!l && !!(r.compareDocumentPosition(l) & Node.DOCUMENT_POSITION_FOLLOWING);
}));
conferir('3. na entrada o "+" some (cada módulo tem o seu)',
  await page.$eval('#fab', b => b.classList.contains('fab-oculto')));

await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900);
conferir('4. abre o módulo com a seta de voltar', /Venda de Doces/.test(await page.textContent('#telaInicio .modulo-cabecalho')));

// ---- vendedor e produto ----
await page.click('#telaInicio button:has-text("+ Novo vendedor")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome', { exact: true }).fill('Mariana');
await page.click('#folha .btn-ouro:has-text("Salvar vendedor")'); await page.waitForTimeout(900);

await page.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await page.waitForTimeout(600);
await page.click('#telaInicio button:has-text("+ Novo produto")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome do doce').fill('Brigadeiro');
// Desde 03/11/2026 o produto tem os quatro valores que o Vitor pediu:
// compra, venda ao cliente final, repasse para o revendedor e para mim.
// As duas partes do repasse fecham com o preço de venda.
await dinheiro('Valor de compra do produto', '100');
await dinheiro('Valor de venda ao cliente final', '400');
await dinheiro('Repasse para o revendedor', '200');
const paraMim = await folha().getByLabel('Repasse para mim', { exact: true }).inputValue();
conferir('5a. repasse para o revendedor de R$ 2,00 deixa R$ 2,00 para mim', /2,00/.test(paraMim), paraMim);
await dinheiro('Repasse para mim', '250');
const paraRev = await folha().getByLabel('Repasse para o revendedor').inputValue();
conferir('5b. e mexendo na minha parte, a do revendedor acompanha', /1,50/.test(paraRev), paraRev);
await dinheiro('Repasse para mim', '200');
const prevProduto = limpo(await folha().textContent());
conferir('5. o produto mostra o lucro do revendedor e o seu por unidade',
  /Lucro do revendedor por unidade\s*R\$ 2,00/.test(prevProduto) && /Seu lucro por unidade\s*R\$ 1,00/.test(prevProduto));
await page.screenshot({ path: dir + '/z42-produto.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar produto")'); await page.waitForTimeout(900);

// ---- entrega de 50 pelo "+" do módulo ----
// 07/11/2026: na Venda de Doces o "+" redondo saiu; a entrega abre pela aba.
const fabOculto = await page.$eval('#fab', b => b.classList.contains('fab-oculto'));
await page.click('#telaInicio .abas-modulo button:has-text("Entregas")'); await page.waitForTimeout(700);
// 07/11/2026: o "+ Registrar entrega" saiu; a entrega abre pelo cartão do vendedor.
await page.click('#telaInicio .cartao-vendedor-entregas:has-text("Mariana")'); await page.waitForTimeout(900);
await page.click('#folha button:has-text("+ Nova entrega para Mariana")'); await page.waitForTimeout(900);
conferir('6. sem o "+" redondo, a entrega abre pelo cartão do vendedor', fabOculto && /Nova entrega/.test(await page.textContent('#folhaTitulo')));
await folha().locator('.contador-campo').fill('50'); await page.waitForTimeout(300);
const prevEntrega = limpo(await folha().textContent());
// 07/11/2026: a entrega pede só quantidade e datas; os valores vêm do cadastro.
conferir('7. a entrega pede só quantidade e datas, com os valores do cadastro',
  /Valores do cadastro: venda R\$ 4,00 e repasse R\$ 2,00 por doce/.test(prevEntrega) &&
  !(await folha().getByLabel('Repasse para mim', { exact: true }).count()) && !(await folha().getByLabel('Venda ao cliente final').count()), prevEntrega.slice(0, 300));
// 03/11/2026: a entrega tem a data do acerto, uma semana depois por padrão.
const dEntrega = await folha().getByLabel('Data da entrega').inputValue();
const dAcerto = await folha().getByLabel('Data do acerto').inputValue();
const semana = new Date(dEntrega + 'T12:00:00'); semana.setDate(semana.getDate() + 7);
const esperado = semana.getFullYear() + '-' + String(semana.getMonth() + 1).padStart(2, '0') + '-' + String(semana.getDate()).padStart(2, '0');
conferir('8c. a entrega tem a data do acerto, uma semana depois', dAcerto === esperado, dEntrega + ' → ' + dAcerto);
await page.click('#folha .btn-ouro:has-text("Registrar entrega")'); await page.waitForTimeout(900);
for (let i = 0; i < 3 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }

// ---- prestação de contas: vendeu 35, devolveu 10 ----
await page.click('#telaInicio .abas-modulo button:has-text("Prestação")'); await page.waitForTimeout(600);
const quem = limpo(await page.textContent('#telaInicio'));
conferir('8d. "Quem tem conta para prestar" mostra o dia do acerto',
  new RegExp('Mariana\\s*50 doce\\(s\\) em estoque · acerto em ' + esperado.slice(8, 10) + ' ').test(quem), (quem.match(/Mariana.{0,60}/) || [''])[0]);
await page.click('#telaInicio .linha:has-text("Mariana")'); await page.waitForTimeout(900);
// 03/11/2026: cada doce mostra a data da entrega e a do acerto.
const pc = (await page.textContent('#folha')).replace(/\s+/g, ' ');
conferir('8e. na prestação, o doce mostra a entrega e o acerto',
  new RegExp('Entregue em ' + dEntrega.split('-').reverse().join('/') + ' \\(50 un\\.\\) · acerto em ' + dAcerto.split('-').reverse().join('/')).test(pc),
  (pc.match(/Entregue em.{0,50}/) || [''])[0]);
await folha().locator('[data-campo="vendidos"] .contador-campo').fill('35');
await folha().locator('[data-campo="devolvidos"] .contador-campo').fill('10');
await page.waitForTimeout(300);
const prest = limpo(await folha().textContent());
console.log('prestação:', prest.slice(0, 420));
conferir('8. ele fica com 5', /Fica em estoque\s*5 un\./.test(prest));
conferir('9. precisa te repassar R$ 70,00', /Precisa te repassar\s*R\$ 70,00/.test(prest));
conferir('10. e lucrou R$ 70,00', /Lucro do vendedor\s*R\$ 70,00/.test(prest));
await page.screenshot({ path: dir + '/z28-prestacao.png', fullPage: true });

// Passar do que ele tem não deixa salvar.
await folha().locator('[data-campo="perdidos"] .contador-campo').fill('6'); await page.waitForTimeout(200);
await page.click('#folha .btn-ouro:has-text("Registrar prestação")'); await page.waitForTimeout(500);
conferir('11. vendido + devolvido + perdido não passa do estoque', /passam do que ele tem/.test(limpo(await folha().textContent())));
await folha().locator('[data-campo="perdidos"] .contador-campo').fill('0'); await page.waitForTimeout(200);

// Pagou só R$ 50,00 agora.
await dinheiro('Recebido agora', '5000');
conferir('12. mostra o que fica pendente', /Fica pendente: R\$ 20,00/.test(limpo(await folha().textContent())));
await page.click('#folha .btn-ouro:has-text("Registrar prestação")'); await page.waitForTimeout(1200);

// 07/11/2026: a primeira aba virou o Resumo; o custo do mês é o das compras
// do fornecedor mais o operacional (aqui, nenhum), e tudo em % da venda.
await page.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await page.waitForTimeout(700);
const linhaMariana = limpo(await page.textContent('#telaInicio .linha-vendedor'));
// 08/11/2026: ao lado do nome, a venda total dela (repasse + lucro dela).
conferir('13. na lista, a venda total dela e o lucro dela', /R\$ 140,00/.test(linhaMariana) && /lucro R\$ 70,00/.test(linhaMariana), linhaMariana);
const totalMes = limpo(await page.textContent('#telaInicio .resumo-doces'));
conferir('14. o total do mês: venda, lucro dos revendedores, custo e lucro da operação, em %',
  /Venda total\s*R\$ 140,00\s*100,0%/.test(totalMes) && /Lucro dos revendedores\s*R\$ 70,00\s*50,0%/.test(totalMes) &&
  /Custo total\s*R\$ 0,00\s*0,0%/.test(totalMes) && /Lucro da operação\s*R\$ 70,00\s*50,0%/.test(totalMes) &&
  /Recebido\s*R\$ 50,00/.test(totalMes) && /A receber\s*R\$ 20,00/.test(totalMes), totalMes.slice(0, 400));
const telaR = limpo(await page.textContent('#telaInicio'));
conferir('15. sem membros, você fica com 100% do lucro da operação', /Membros da empresa.*Você\s*dono da operação.*R\$ 70,00\s*100,0%/.test(telaR), (telaR.match(/Membros da empresa.{0,120}/) || [''])[0]);

// ---- a ficha da vendedora ----
await page.click('#telaInicio .linha-vendedor'); await page.waitForTimeout(900);
const ficha = limpo(await folha().textContent());
conferir('16. a ficha mostra 5 com ela e R$ 20,00 a repassar', /Em estoque\s*5 un\./.test(ficha) && /A te repassar\s*R\$ 20,00/.test(ficha));
conferir('17. e o histórico completo (entrega, prestação, pagamento)',
  /Prestação de contas · Mariana/.test(ficha) && /Pagamento · Mariana/.test(ficha) && /Mariana · 50 un\./.test(ficha));
await page.click('#folha button:has-text("Registrar pagamento")'); await page.waitForTimeout(900);
conferir('18. o pagamento já vem com o pendente', /R\$ 20,00/.test(limpo(await folha().locator('.valor-grande').inputValue())));
await page.click('#folha .btn-ouro:has-text("Salvar pagamento")'); await page.waitForTimeout(1200);
const fichaDepois = limpo(await folha().textContent());
conferir('19. salvando, volta para a ficha já em dia', /A te repassar\s*R\$ 0,00/.test(fichaDepois), fichaDepois.slice(0, 160));
await page.goBack(); await page.waitForTimeout(800);

// ---- tudo subiu para o servidor ----
const linhas = await doServidor(ls => ls.length >= 5);
const tipos = linhas.map(l => l.tipo).sort().join(',');
conferir('20. vendedor, produto, entrega, prestação e pagamentos sobem',
  tipos === 'doce_acerto,doce_entrega,doce_pagamento,doce_pagamento,doce_produto,doce_vendedor', tipos);

// ---- o painel ----
await page.click('#telaInicio .modulo-voltar'); await page.waitForTimeout(800);
await page.click('#telaInicio .cartao-resumo-emp'); await page.waitForTimeout(900);
const painel = limpo(await page.textContent('#telaInicio'));
conferir('21. o painel soma o recebido sem misturar com o a receber',
  /Recebido no período\s*R\$ 70,00/.test(painel) && /A receber\s*R\$ 0,00/.test(painel), painel.slice(0, 300));
await page.screenshot({ path: dir + '/z29-painel.png', fullPage: true });

// ---- recarregar não perde nada ----
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3500);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")').catch(() => {}); await page.waitForTimeout(900);
await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900);
conferir('22. recarregando, Mariana continua lá', /Mariana/.test(limpo(await page.textContent('#telaInicio'))));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: distribuição de doces');

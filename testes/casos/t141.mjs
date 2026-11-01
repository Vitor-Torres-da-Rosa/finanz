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
conferir('1. o Empreendedor mostra os três módulos e o painel',
  modulos.join('|') === 'Serviços e Vendas|Uber e Corridas|Distribuição de Doces|Painel geral', modulos.join(' | '));
conferir('2. e o resumo do mês, que abre o painel', await page.locator('#telaInicio [data-modulo="painel"]').count() === 1);
conferir('3. na entrada o "+" some (cada módulo tem o seu)',
  await page.$eval('#fab', b => b.classList.contains('fab-oculto')));

await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900);
conferir('4. abre o módulo com a seta de voltar', /Distribuição de Doces/.test(await page.textContent('#telaInicio .modulo-cabecalho')));

// ---- vendedor e produto ----
await page.click('#telaInicio button:has-text("+ Novo vendedor")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome', { exact: true }).fill('Mariana');
await page.click('#folha .btn-ouro:has-text("Salvar vendedor")'); await page.waitForTimeout(900);

await page.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await page.waitForTimeout(600);
await page.click('#telaInicio button:has-text("+ Novo produto")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome do doce').fill('Brigadeiro');
await dinheiro('Repasse por unidade', '200');
await dinheiro('Preço de venda', '400');
await dinheiro('Seu custo de produção (opcional)', '100');
const prevProduto = limpo(await folha().textContent());
conferir('5. o produto mostra o lucro do vendedor e o seu por doce',
  /Lucro do vendedor por doce\s*R\$ 2,00/.test(prevProduto) && /Seu lucro por doce\s*R\$ 1,00/.test(prevProduto));
await page.click('#folha .btn-ouro:has-text("Salvar produto")'); await page.waitForTimeout(900);

// ---- entrega de 50 pelo "+" do módulo ----
await page.click('#fab'); await page.waitForTimeout(900);
conferir('6. o "+" dos Doces abre a entrega', /Nova entrega/.test(await page.textContent('#folhaTitulo')));
await folha().locator('.contador-campo').fill('50'); await page.waitForTimeout(300);
const prevEntrega = limpo(await folha().textContent());
conferir('7. a entrega calcula venda, repasse e lucro do vendedor',
  /Total de venda\s*R\$ 200,00/.test(prevEntrega) && /Repasse para você\s*R\$ 100,00/.test(prevEntrega) &&
  /Lucro estimado do vendedor\s*R\$ 100,00/.test(prevEntrega));
await page.click('#folha .btn-ouro:has-text("Registrar entrega")'); await page.waitForTimeout(900);

// ---- prestação de contas: vendeu 35, devolveu 10 ----
await page.click('#telaInicio .abas-modulo button:has-text("Prestação")'); await page.waitForTimeout(600);
await page.click('#telaInicio .linha:has-text("Mariana")'); await page.waitForTimeout(900);
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

await page.click('#telaInicio .abas-modulo button:has-text("Vendedores")'); await page.waitForTimeout(700);
const linhaMariana = limpo(await page.textContent('#telaInicio .linha-vendedor'));
conferir('13. na lista, R$ 20,00 a receber e o lucro dela', /R\$ 20,00/.test(linhaMariana) && /lucro R\$ 70,00/.test(linhaMariana), linhaMariana);
const totalMes = limpo(await page.textContent('#telaInicio .cartao-destaque'));
conferir('14. o total do mês separa recebido de a receber',
  /Repasse do mês\s*R\$ 70,00/.test(totalMes) && /Recebido no mês\s*R\$ 50,00/.test(totalMes) && /A receber\s*R\$ 20,00/.test(totalMes));
conferir('15. e o seu lucro desconta o custo de produção (35 × R$ 1,00)', /Seu lucro\s*R\$ 35,00/.test(totalMes), totalMes.slice(0, 200));

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
await page.click('#telaInicio [data-modulo="painel"]'); await page.waitForTimeout(900);
const painel = limpo(await page.textContent('#telaInicio'));
conferir('21. o painel soma o recebido sem misturar com o a receber',
  /Recebido no período\s*R\$ 70,00/.test(painel) && /A receber hoje\s*R\$ 0,00/.test(painel), painel.slice(0, 300));
await page.screenshot({ path: dir + '/z29-painel.png', fullPage: true });

// ---- recarregar não perde nada ----
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3500);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")').catch(() => {}); await page.waitForTimeout(900);
await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900);
conferir('22. recarregando, Mariana continua lá', /Mariana/.test(limpo(await page.textContent('#telaInicio'))));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: distribuição de doces');

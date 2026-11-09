// Resumo de Serviços e Vendas organizado e o Resumo do Empreendedor com
// tudo discriminado (pedidos do Vitor em 08/11/2026).
//
// - Em Serviços e Vendas e no Uber o "+" redondo saiu.
// - O Resumo de Serviços mostra faturamento, despesas e lucro em cima, e
//   embaixo linhas que abrem ao tocar: Serviços, Vendas, Recebido, A receber.
// - No Resumo do Empreendedor, "Dinheiro" virou "Recebimentos", "A receber
//   hoje" virou "A receber", e cada valor abre os itens que o formam.
import { chromium, dir, ENDERECO, irParaClientes } from '../comum.mjs';
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
const dinheiro = async (loc, digitos) => {
  await loc.click(); for (let i = 0; i < 14; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(200);
};
const fecharFolhas = async () => {
  for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
};
const fabOculto = () => page.$eval('#fab', b => b.classList.contains('fab-oculto'));

await page.clock.setFixedTime(new Date(2026, 10, 8, 15, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t161-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await irParaClientes(page);
conferir('1. em Serviços e Vendas o "+" redondo some', await fabOculto());
await page.click('#telaInicio .cartao-acao:has-text("+ Novo")'); await page.waitForTimeout(800);
await folha().locator('input.entrada[type=text]').first().fill('Ana Paula');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .linha-alvo:has-text("Ana Paula")'); await page.waitForTimeout(900);

// Serviço de R$ 200 com R$ 50 de despesa.
await page.click('#folha button:has-text("+ Nova venda ou serviço")'); await page.waitForTimeout(900);
await dinheiro(folha().locator('.valor-grande'), '20000');
await folha().locator('input[placeholder="Ex.: Troca de embreagem"]').fill('Troca de óleo');
await page.click('#folha button:has-text("+ Adicionar despesa")'); await page.waitForTimeout(300);
await folha().getByLabel('Despesa 1', { exact: true }).fill('Óleo');
await dinheiro(folha().getByLabel('Valor da despesa 1'), '5000');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Agora não")').catch(() => {}); await page.waitForTimeout(600);

// Venda de R$ 1.000.
await page.click('#folha button:has-text("+ Nova venda ou serviço")'); await page.waitForTimeout(900);
await dinheiro(folha().locator('.valor-grande'), '100000');
await folha().locator('input[placeholder="Ex.: Troca de embreagem"]').fill('Moto Honda');
await folha().locator('.parcela-linha.edita:has(.q:text-is("Tipo")) .selecao').click(); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Venda")'); await page.waitForTimeout(600);
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Agora não")').catch(() => {}); await page.waitForTimeout(600);
await fecharFolhas();

// ---- o Resumo de Serviços ----
await page.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await page.waitForTimeout(900);
const r = await tela();
conferir('2. em cima: faturamento, despesas e lucro',
  /Faturamento de novembro\s*R\$ 1\.200,00/.test(r) && /Despesas\s*R\$ 50,00/.test(r) && /Lucro\s*R\$ 1\.150,00/.test(r), r.slice(0, 260));
const linhasS = await page.$$eval('#telaInicio .sanfona-topo', ns => ns.map(n => n.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()));
conferir('3. embaixo, as linhas no mesmo padrão: Serviços, Vendas, Recebido, A receber e o gráfico',
  linhasS.length === 5 && /Serviços\s*1 serviço\(s\)\s*R\$ 200,00/.test(linhasS[0]) && /Vendas\s*1 venda\(s\)\s*R\$ 1\.000,00/.test(linhasS[1]) &&
  /Recebido/.test(linhasS[2]) && /A receber.*R\$ 1\.200,00/.test(linhasS[3]) && /Evolução do faturamento/.test(linhasS[4]), linhasS.join(' | '));
conferir('4. o gráfico e os últimos registros não ocupam a tela',
  !(await page.locator('#telaInicio .grafico-animado').count()) && !/Últimos registros/.test(r));
conferir('5. as linhas começam fechadas', !(await page.locator('#telaInicio .sanfona.aberta').count()));

await page.click('#telaInicio .sanfona-topo:has-text("Vendas")'); await page.waitForTimeout(500);
const corpoV = limpo(await page.locator('#telaInicio .sanfona.aberta .sanfona-corpo').textContent());
conferir('6. tocando em Vendas, abre embaixo só as vendas', /Moto Honda/.test(corpoV) && !/Troca de óleo/.test(corpoV), corpoV);
await page.screenshot({ path: dir + '/z61-resumo-servicos.png', fullPage: true });
await page.click('#telaInicio .sanfona.aberta .sanfona-ver'); await page.waitForTimeout(900);
const fV = limpo(await folha().textContent());
conferir('7. e "Abrir a lista" mostra as vendas do período', /Vendas · novembro/.test(await page.textContent('#folhaTitulo')) &&
  /R\$ 1\.000,00/.test(fV) && /1 venda\(s\) para 1 cliente\(s\)/.test(fV) && /Moto Honda/.test(fV), fV.slice(0, 200));
await fecharFolhas();
await page.click('#telaInicio .sanfona-topo:has-text("Vendas")'); await page.waitForTimeout(400);
conferir('8. tocando de novo, fecha', !(await page.locator('#telaInicio .sanfona.aberta').count()));
await page.click('#telaInicio .sanfona-topo:has-text("Serviços")'); await page.waitForTimeout(400);
const corpoS = limpo(await page.locator('#telaInicio .sanfona.aberta .sanfona-corpo').textContent());
conferir('9. Serviços abre só os serviços', /Troca de óleo/.test(corpoS) && !/Moto Honda/.test(corpoS), corpoS);
await page.click('#telaInicio .sanfona-topo:has-text("Serviços")'); await page.waitForTimeout(300);

// ---- Uber sem o "+" ----
await page.click('#telaInicio .modulo-voltar'); await page.waitForTimeout(800);
await page.click('#telaInicio [data-modulo="uber"]'); await page.waitForTimeout(900);
conferir('10. no Uber o "+" redondo some', await fabOculto());
await page.click('#telaInicio .modulo-voltar'); await page.waitForTimeout(800);

// ---- o Resumo do Empreendedor ----
await page.click('#telaInicio .cartao-resumo-emp'); await page.waitForTimeout(900);
const p = await tela();
conferir('11. "Dinheiro" virou "Recebimentos" e "A receber" sem o "hoje"',
  /Recebimentos/.test(p) && !/Dinheiro/.test(p) && /A receber\s*R\$ 1\.200,00/.test(p) && !/A receber hoje/.test(p), p.slice(0, 400));
conferir('12. a explicação fala de dinheiro, Pix ou cartão', /em dinheiro, Pix ou cartão/.test(p));
await page.screenshot({ path: dir + '/z63-painel-topo.png' });

await page.click('#telaInicio .painel-totais .painel-num[data-qual="faturamento"]'); await page.waitForTimeout(900);
const fF = limpo(await folha().textContent());
conferir('13. Faturamento abre os itens, separados por módulo',
  /Faturamento · novembro de 2026/.test(await page.textContent('#folhaTitulo')) &&
  /Serviços e Vendas\s*R\$ 1\.200,00/.test(fF) && /Moto Honda/.test(fF) && /Troca de óleo/.test(fF), fF.slice(0, 300));
await page.screenshot({ path: dir + '/z62-painel-faturamento.png', fullPage: true });
await page.click('#folha .linha:has-text("Moto Honda")'); await page.waitForTimeout(900);
conferir('14. tocando num item, abre o registro', /Moto Honda/.test(await folha().locator('input[placeholder="Ex.: Troca de embreagem"]').inputValue().catch(() => '')));
await fecharFolhas();

await page.click('#telaInicio .painel-totais .painel-num[data-qual="despesas"]'); await page.waitForTimeout(900);
const fD = limpo(await folha().textContent());
conferir('15. Despesas mostra o custo do registro', /Troca de óleo/.test(fD) && /− R\$ 50,00/.test(fD) && !/Moto Honda/.test(fD), fD.slice(0, 300));
await fecharFolhas();

await page.click('#telaInicio .painel-totais .painel-num[data-qual="lucro"]'); await page.waitForTimeout(900);
const fL = limpo(await folha().textContent());
conferir('16. Lucro mostra a conta e os itens que entram e saem',
  /Faturamento\s*R\$ 1\.200,00\s*Despesas\s*− R\$ 50,00\s*Lucro\s*R\$ 1\.150,00/.test(fL) && /Moto Honda/.test(fL) && /− R\$ 50,00/.test(fL), fL.slice(0, 300));
await fecharFolhas();

await page.click('#telaInicio .painel-totais .painel-num[data-qual="pendente"]'); await page.waitForTimeout(900);
const fP = limpo(await folha().textContent());
conferir('17. A receber mostra quem deve', /Ana Paula\s*.*R\$ 1\.200,00/.test(fP), fP.slice(0, 300));
await fecharFolhas();

await page.click('#telaInicio [data-painel="servicos"] .painel-num[data-qual="faturamento"]'); await page.waitForTimeout(900);
const fM = limpo(await folha().textContent());
conferir('18. no "Por módulo", cada valor também abre os itens',
  /Faturamento · Serviços e Vendas/.test(await page.textContent('#folhaTitulo')) && /Moto Honda/.test(fM) && /Troca de óleo/.test(fM), fM.slice(0, 200));
await fecharFolhas();
await page.click('#telaInicio [data-painel="servicos"] .painel-nome'); await page.waitForTimeout(900);
conferir('19. e o nome do módulo abre o módulo', /Serviços e Vendas/.test(await page.textContent('#telaInicio .modulo-cabecalho')));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

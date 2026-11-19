// A fatura contada uma vez só, no app inteiro.
//
// Cenário: compras no cartão neste mês (R$ 689,90) e o pagamento da fatura
// do mês passado saindo da conta (R$ 500,00), mais o aluguel (R$ 1.200,00).
//
// Desde 19/11/2026 (pedido do Vitor) o extrato do banco é a verdade: as
// compras do cartão só contam como gasto na fatura que estiver ligada a um
// pagamento do mesmo valor no mesmo mês. Aqui o pagamento (R$ 500,00) não
// bate com as compras (R$ 689,90), então nada se liga:
//
//   despesas = 1200,00 + 500,00            = 1.700,00  (o que saiu do banco)
//   errado   = 1200,00 + 689,90 + 500,00   = 2.389,90  → não pode aparecer
// O caso ligado (compras no lugar do pagamento) está no t177.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t85' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const hoje = new Date();
  const d = (dia) => hoje.getFullYear() + '-' + String(hoje.getMonth()+1).padStart(2,'0') + '-' + String(dia).padStart(2,'0');
  const dados = {
    contas: [{ id:'cc-t85', nome:'C6 Bank', tipo:'Conta corrente', saldoInicial:1000000 },
             { id:'cd-t85', nome:'C6 (cartão)', tipo:'Cartão de crédito', saldoInicial:0 }],
    orcamentos: { geral: 200000, categorias: { 'Alimentação': 100000 } },
    lancamentos: [
      { id:'t85-e1', tipo:'entrada', valor:800000, data:d(5), contaId:'cc-t85', categoria:'Salário', descricao:'Salário' },
      { id:'t85-s1', tipo:'saida', valor:120000, data:d(6), contaId:'cc-t85', categoria:'Moradia', descricao:'Aluguel' },
      { id:'t85-c1', tipo:'saida', valor:65000, data:d(7), contaId:'cd-t85', categoria:'Alimentação', descricao:'Mercado do bairro' },
      { id:'t85-c2', tipo:'saida', valor:3990, data:d(8), contaId:'cd-t85', categoria:'Assinaturas', descricao:'Streaming Mensal' },
      { id:'t85-f1', tipo:'saida', valor:50000, data:d(9), contaId:'cc-t85', categoria:'Outros', descricao:'PAGAMENTO DE FATURA' }
    ]
  };
  const f = new File([JSON.stringify({ app:'finanz', dados })], 'b.json', { type:'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);

const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

// Contagem dupla é o tipo de erro que volta calado. Aqui o teste falha de
// verdade, com código de saída, em vez de só imprimir "ERRADO".
let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};

// --- Início ---
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1500);
const kpis = await page.$$eval('#telaInicio .kpi', ns => ns.map(n => ({
  rotulo: n.querySelector('.rotulo').textContent, valor: n.querySelector('.n').textContent })));
const despesas = kpis.find(k => k.rotulo === 'Despesas');
conferir('1. KPI Despesas = R$ 1.700,00 (o que saiu do banco; compras sem pagamento ligado não contam)', !!despesas && /1\.700,00/.test(despesas.valor),
  despesas && despesas.valor);

// O cartão "Fluxo de caixa" saiu do Início em 17/11/2026, a pedido do
// Vitor. A conta de caixa segue no relatório (verificações 11 a 13).
conferir('2. o cartão Fluxo de caixa não está mais no Início',
  !(await page.locator('#telaInicio .cartao:has-text("Fluxo de caixa")').count()));

const distrib = await page.$eval('#telaInicio .cartao:has-text("Distribuição de gastos")', n => n.textContent.replace(/\s+/g,' '));
conferir('4. sem fatura ligada, o pagamento entra na distribuição e não há aviso de fatura', !/de fatura paga ficou de fora/.test(distrib) && /Outros/.test(distrib));
conferir('5. a soma dobrada (R$ 2.389,90) não aparece no Início',
  !/2\.389,90/.test(await page.textContent('#telaInicio')));
await page.screenshot({ path: dir+'/v01-inicio.png', fullPage: true });

// --- Transações ---
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1500);
const tTxt = await page.textContent('#telaTransacoes');
conferir('6. Saídas do período = R$ 1.700,00', /Saídas\s*R\$ 1\.700,00/.test(limpo(tTxt)));
conferir('7. nada ficou fora das Saídas', !/Fora de "Saídas"/.test(limpo(tTxt)));
const linhaFat = await page.$$eval('#telaTransacoes .linha', ns => ns
  .filter(n => /FATURA/i.test(n.textContent))
  .map(n => n.textContent.replace(/\s+/g,' ').trim()));
conferir('8. o pagamento continua listado e conta como despesa (não há fatura ligada)',
  linhaFat.length === 1 && !/não conta como despesa/.test(linhaFat[0]) && /500,00/.test(linhaFat[0]),
  linhaFat[0]);
await page.screenshot({ path: dir+'/v02-transacoes.png', fullPage: true });

// --- Planejamento: o orçamento mede consumo ---
await page.click('#navegacao button:has-text("Planejar")'); await page.waitForTimeout(1500);
const pTxt = limpo(await page.textContent('#telaPlanejamento'));
conferir('9. orçamento geral mede o que saiu do banco', /1\.700,00 \/ R\$ 2\.000,00/.test(pTxt),
  (pTxt.match(/R\$ [\d.,]+ \/ R\$ [\d.,]+/) || ['?'])[0]);
conferir('10. a compra no cartão sem pagamento ligado não pesa no teto de Alimentação', !/650,00/.test(pTxt));
await page.screenshot({ path: dir+'/v03-planejamento.png', fullPage: true });

// --- Relatório de fluxo de caixa: as duas contas, cada uma com seu nome ---
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
await page.evaluate(() => { const b = [...document.querySelectorAll('#telaMais button')]
  .find(n => /Fluxo de caixa/.test(n.textContent)); if (b) b.click(); });
await page.waitForTimeout(1500);
const rTxt = limpo(await page.textContent('#relConteudo'));
conferir('11. relatório: Saídas das contas = R$ 1.700,00', /Saídas das contas\s*R\$ 1\.700,00/.test(rTxt));
conferir('12. relatório: sem fatura ligada, despesas e saídas das contas são o mesmo número', !/Consumo do mês/.test(rTxt));
conferir('13. e não precisa explicar duas contas', !/duas contas diferentes/.test(rTxt));
await page.screenshot({ path: dir+'/v04-relatorio.png', fullPage: true });
await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: a fatura foi contada uma vez só');

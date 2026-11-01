// Previsto para o mês, no resumo do Empreendedor.
//
// Pedido do Vitor em 01/11/2026: junto do "A receber de todos os
// clientes", uma estimativa pelos vencimentos — se uma parcela vence dia
// 20 de novembro, ela entra em novembro, mais todas as outras que vencem
// dentro do mês. O já recebido no mês soma junto.
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
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t139-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Neste mês: Fabi R$ 1.200 no dia 20 e R$ 800 no último dia; Caçapava
// R$ 500 no dia 5, dos quais já pagou R$ 200 neste mês. Fora do mês:
// Fabi no mês que vem e no mês passado (atrasada), e uma parcela de um
// cliente que não existe mais.
await page.evaluate(() => new Promise(res => {
  const h = new Date();
  const d = (m, dia) => { const x = new Date(h.getFullYear(), h.getMonth() + m, dia);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const ultimo = new Date(h.getFullYear(), h.getMonth() + 1, 0).getDate();
  const dados = {
    contas: [{ id: 'cc', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 }],
    lancamentos: [],
    clientes: [{ id: 'fabi', nome: 'Fabi do juliano' }, { id: 'cac', nome: 'Caçapava vizinho' }],
    servicos: [{ id: 'sf', clienteId: 'fabi', nome: 'Reforma', tipo: 'Serviço', valor: 500000, data: d(-2, 1) },
               { id: 'sc', clienteId: 'cac', nome: 'Pintura', tipo: 'Serviço', valor: 50000, data: d(-1, 1) }],
    parcelas: [
      { id: 'f0', clienteId: 'fabi', servicoId: 'sf', numero: 1, total: 4, valor: 100000, vencimento: d(-1, 20) },
      { id: 'f1', clienteId: 'fabi', servicoId: 'sf', numero: 2, total: 4, valor: 120000, vencimento: d(0, 20) },
      { id: 'f2', clienteId: 'fabi', servicoId: 'sf', numero: 3, total: 4, valor: 80000, vencimento: d(0, ultimo) },
      { id: 'f3', clienteId: 'fabi', servicoId: 'sf', numero: 4, total: 4, valor: 200000, vencimento: d(1, 20) },
      { id: 'c1', clienteId: 'cac', servicoId: 'sc', numero: 1, total: 1, valor: 50000, vencimento: d(0, 5) },
      { id: 'x1', clienteId: 'sumiu', servicoId: '', numero: 1, total: 1, valor: 999900, vencimento: d(0, 10) }
    ],
    pagamentos: [{ id: 'g1', clienteId: 'cac', servicoId: 'sc', parcelaId: 'c1', valor: 20000, data: d(0, 1) }]
  };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1000);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(1200);

const mes = MESES[new Date().getMonth()];
const bloco = limpo(await page.textContent('#telaInicio .previsto-mes').catch(() => ''));
console.log('bloco:', bloco);
// 1.200 + 800 + (500 - 200) a vencer = 2.300; + 200 recebido = 2.500.
conferir('1. diz de qual mês é', new RegExp('Previsto para ' + mes, 'i').test(bloco));
conferir('2. soma o que vence no mês e o já recebido', /R\$ 2\.500,00/.test(bloco), bloco);
conferir('3. separa o recebido do que falta', /R\$ 200,00 já recebido/.test(bloco) && /R\$ 2\.300,00 em 3 parcela\(s\) a vencer/.test(bloco));
await page.screenshot({ path: dir + '/z24-previsto-do-mes.png' });

await page.click('#telaInicio .previsto-mes'); await page.waitForTimeout(900);
const folha = limpo(await page.textContent('#folha'));
const linhas = await page.$$eval('#folha .linha', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
console.log('parcelas do mês:', linhas);
conferir('4. a lista tem só as 3 que vencem no mês', linhas.length === 3, linhas.length);
conferir('5. em ordem de vencimento, com o que falta de cada uma',
  /Caçapava/.test(linhas[0] || '') && /R\$ 300,00/.test(linhas[0] || '') &&
  /Fabi/.test(linhas[1] || '') && /R\$ 1\.200,00/.test(linhas[1] || '') && /R\$ 800,00/.test(linhas[2] || ''));
conferir('6. cliente apagado não entra', !/9\.999,00/.test(folha));
await page.screenshot({ path: dir + '/z25-previsto-lista.png' });

// Toca numa parcela: abre o cliente; voltando, a lista está lá de novo.
await page.click('#folha .linha >> nth=1'); await page.waitForTimeout(900);
conferir('7. tocando, abre a ficha do cliente', /Fabi do juliano/.test(await page.textContent('#folhaTitulo')));
await page.goBack(); await page.waitForTimeout(900);
conferir('8. e voltar devolve a lista do mês', /Previsto para/i.test(await page.textContent('#folhaTitulo')));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: o previsto do mês vem dos vencimentos');

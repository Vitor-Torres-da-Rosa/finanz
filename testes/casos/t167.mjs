// Sino: dias sem lançamentos do extrato (pedido do Vitor em 16/11/2026).
// De 5 dias em diante o sino acende e o aviso vem em primeiro, com o botão
// para importar. Lançamento feito à mão não conta: o que vale é o extrato.
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

await page.clock.setFixedTime(new Date(2026, 10, 16, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t167-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// O último extrato vai até 09/11; em 15/11 entrou um gasto lançado à mão.
await page.evaluate(() => new Promise(res => {
  const s = Math.random().toString(36).slice(2);
  const conta = 'cc' + s, imp = 'im' + s;
  const dados = {
    contas: [{ id: conta, nome: 'C6', tipo: 'Conta corrente', saldoInicial: 100000 }, { id: 'it' + s, nome: 'Itaú', tipo: 'Conta corrente', saldoInicial: 0 }],
    importacoes: [{ id: imp, contaId: conta, banco: 'C6', arquivo: 'extrato.pdf', quando: Date.now(), quantos: 2, de: '2026-11-01', ate: '2026-11-09' },
                  { id: 'ii' + s, contaId: 'it' + s, banco: 'Itaú', arquivo: 'itau.pdf', quando: Date.now(), quantos: 1, de: '2026-11-10', ate: '2026-11-14' }],
    lancamentos: [
      { id: 'l1' + s, tipo: 'saida', valor: 5000, descricao: 'Mercado', categoria: 'Mercado', data: '2026-11-08', contaId: conta, importacaoId: imp },
      { id: 'l2' + s, tipo: 'saida', valor: 3000, descricao: 'Padaria', categoria: 'Alimentação', data: '2026-11-09', contaId: conta, importacaoId: imp },
      { id: 'l3' + s, tipo: 'saida', valor: 2000, descricao: 'Lanche', categoria: 'Alimentação', data: '2026-11-15', contaId: conta },
      { id: 'l4' + s, tipo: 'saida', valor: 1000, descricao: 'Tarifa', categoria: 'Impostos e taxas', data: '2026-11-14', contaId: 'it' + s, importacaoId: 'ii' + s }
    ]
  };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1200);

conferir('1. com 7 dias sem extrato, o sino acende', await page.locator('#telaInicio .marca-sino .ponto-aviso').count() === 1);
await page.click('#telaInicio .marca-sino');
await page.waitForFunction(() => /dias sem extrato|Principais|Ver a análise/.test(document.getElementById('folha').textContent), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);
const tudo = limpo(await page.textContent('#folha'));
conferir('2. o aviso é do banco parado, com os dias; o lançamento à mão não conta e o Itaú em dia não avisa',
  /C6: 7 dias sem extrato\s*7 dias\s*O último lançamento do extrato do C6 é de 09\/11\/2026/.test(tudo) && !/Itaú: \d+ dias sem extrato/.test(tudo), (tudo.match(/.{0,40}dias sem extrato.{0,120}/) || [''])[0]);
conferir('3. com o botão para importar', /Importar extrato/.test(tudo));
await page.screenshot({ path: dir + '/z78-sino-extrato.png' });
// 17/11/2026: o banco parado é aviso do sino, não assunto da análise do mês.
conferir('3b. o sino abre "Avisos", com o caminho para a análise', (await page.textContent('#folhaTitulo')) === 'Avisos' &&
  /Ver a análise de novembro/.test(tudo), await page.textContent('#folhaTitulo'));
await page.click('#folha button:has-text("Ver a análise de novembro")'); await page.waitForTimeout(1200);
const analise = limpo(await page.textContent('#folha'));
conferir('3c. e a análise de novembro não mostra a inatividade do banco', /Análise de novembro/.test(await page.textContent('#folhaTitulo')) &&
  !/dias sem extrato/.test(analise), analise.slice(0, 160));
await page.goBack(); await page.waitForTimeout(800);

// Com 4 dias, ainda não avisa.
await page.goBack().catch(() => {}); await page.waitForTimeout(800);
await page.clock.setFixedTime(new Date(2026, 10, 13, 9, 0, 0));
await page.click('#navegacao button:has-text("Transações")').catch(() => {}); await page.waitForTimeout(600);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1200);
await page.click('#telaInicio .marca-sino'); await page.waitForTimeout(3000);
const t2 = limpo(await page.textContent('#folha'));
console.log('com 4 dias:', t2.slice(0, 160));
conferir('4. com menos de 5 dias, não avisa', !/dias sem extrato/.test(t2));

// ---- 16/11/2026: tocando na conta, os extratos dela ----
for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
await page.click('#telaInicio .linha-alvo:has-text("C6")'); await page.waitForTimeout(1000);
const fc = limpo(await page.textContent('#folha'));
conferir('5. a conta mostra os extratos importados', /Extratos\s*\+ Importar\s*01\/11\/2026 a 09\/11\/2026\s*extrato\.pdf · 2 lançamento\(s\)/.test(fc), (fc.match(/Extratos.{0,120}/) || [''])[0]);
await page.locator('#folha .cartao-extratos').screenshot({ path: dir + '/z79-extratos-da-conta.png' }).catch(() => {});
await page.click('#folha .cartao-extratos .linha:has-text("01/11/2026 a 09/11/2026")'); await page.waitForTimeout(1200);
const fe = limpo(await page.textContent('#folha'));
conferir('6. tocando no extrato, o que veio dele', /Extrato de 01\/11\/2026 a 09\/11\/2026/.test(await page.textContent('#folhaTitulo')) &&
  /Lançamentos\s*2/.test(fe) && /Saídas\s*− R\$ 80,00/.test(fe) && /Mercado/.test(fe) && /Padaria/.test(fe) && !/Lanche/.test(fe) && /Baixar o arquivo|Arquivo não guardado/.test(fe), fe.slice(0, 300));
await page.screenshot({ path: dir + '/z80-um-extrato.png' });
await page.goBack(); await page.waitForTimeout(900);
conferir('7. voltando, a conta de novo', /Extratos/.test(limpo(await page.textContent('#folha'))) && (await page.textContent('#folhaTitulo')) === 'C6');

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

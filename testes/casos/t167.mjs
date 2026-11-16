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
    contas: [{ id: conta, nome: 'C6', tipo: 'Conta corrente', saldoInicial: 100000 }],
    importacoes: [{ id: imp, contaId: conta, banco: 'C6', arquivo: 'extrato.pdf', quando: Date.now(), quantos: 2, de: '2026-11-01', ate: '2026-11-09' }],
    lancamentos: [
      { id: 'l1' + s, tipo: 'saida', valor: 5000, descricao: 'Mercado', categoria: 'Mercado', data: '2026-11-08', contaId: conta, importacaoId: imp },
      { id: 'l2' + s, tipo: 'saida', valor: 3000, descricao: 'Padaria', categoria: 'Alimentação', data: '2026-11-09', contaId: conta, importacaoId: imp },
      { id: 'l3' + s, tipo: 'saida', valor: 2000, descricao: 'Lanche', categoria: 'Alimentação', data: '2026-11-15', contaId: conta }
    ]
  };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1200);

conferir('1. com 7 dias sem extrato, o sino acende', await page.locator('#telaInicio .marca-sino .ponto-aviso').count() === 1);
await page.click('#telaInicio .marca-sino'); await page.waitForTimeout(1200);
const t = limpo(await page.textContent('#relatorio, #folha').catch(() => ''));
const tudo = t || limpo(await page.textContent('body'));
conferir('2. o primeiro aviso diz quantos dias faz, e o lançamento à mão não conta',
  /7 dias sem lançamentos do extrato\s*7 dias\s*O último lançamento que veio do extrato é de 09\/11\/2026/.test(tudo), (tudo.match(/.{0,40}dias sem lançamentos.{0,120}/) || [''])[0]);
conferir('3. com o botão para importar', /Importar extrato/.test(tudo));
await page.screenshot({ path: dir + '/z78-sino-extrato.png' });

// Com 4 dias, ainda não avisa.
await page.goBack().catch(() => {}); await page.waitForTimeout(800);
await page.clock.setFixedTime(new Date(2026, 10, 13, 9, 0, 0));
await page.click('#navegacao button:has-text("Transações")').catch(() => {}); await page.waitForTimeout(600);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1200);
await page.click('#telaInicio .marca-sino'); await page.waitForTimeout(1200);
const t2 = limpo(await page.textContent('body'));
conferir('4. com menos de 5 dias, não avisa', !/dias sem lançamentos do extrato/.test(t2));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

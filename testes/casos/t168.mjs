// Extrato do C6 exportado: a caixa do topo ("Período da Exportação" e
// "Saldo no dia da exportação") não é lançamento (pedido do Vitor em
// 17/11/2026: cada PDF somava R$ 200 de entrada).
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
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

await page.clock.setFixedTime(new Date(2026, 10, 17, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t168-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// ---- 1. a importação nova ignora a caixa do topo ----
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await folha().locator('input.entrada[type=text]').first().fill('C6 Bank');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
page.on('filechooser', async fc => { await fc.setFiles(amostras + '/c6-exportacao.pdf'); });
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(700);
await page.click('#telaMais .linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .item-extrato', { timeout: 60000 }); await page.waitForTimeout(600);
const itens = await page.$$eval('#folha .item-extrato', ns => ns.map(n => n.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()));
conferir('1. do PDF exportado, só o Pix entra; o saldo da exportação não vira lançamento',
  itens.length === 1 && /Pix recebido de FULANO/i.test(itens[0]) && /100,00/.test(itens[0]) && !itens.some(t => /200,00|a 10\/11\/2020/.test(t)), JSON.stringify(itens));

// ---- 2. as entradas fantasmas que já tinham entrado saem sozinhas ----
const ctx2 = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const p2 = await ctx2.newPage();
await p2.clock.setFixedTime(new Date(2026, 10, 17, 9, 0, 0));
await p2.goto(ENDERECO, { waitUntil:'networkidle' }); await p2.waitForTimeout(400);
await p2.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await p2.reload({ waitUntil:'networkidle' }); await p2.waitForTimeout(1600);
await p2.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await p2.click('.btn-dourado:has-text("Criar minha conta")'); await p2.waitForTimeout(500);
const c2 = p2.locator('.ent-campo input');
await c2.nth(0).fill('Vitor'); await c2.nth(1).fill('t168b-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c2.nth(3).fill('senha123');
await p2.click('.btn-dourado:has-text("Continuar")'); await p2.waitForTimeout(400);
await p2.click('.btn-dourado:has-text("Continuar")'); await p2.waitForTimeout(400);
await p2.click('.btn-dourado:has-text("Criar minha conta")'); await p2.waitForTimeout(3000);
await p2.evaluate(() => new Promise(res => {
  const s = Math.random().toString(36).slice(2);
  const conta = 'c6' + s, imp = 'im' + s;
  const dados = {
    contas: [{ id: conta, nome: 'C6 Bank', tipo: 'Conta corrente', saldoInicial: 0 }],
    importacoes: [{ id: imp, contaId: conta, banco: 'C6 Bank', arquivo: 'extrato.pdf', quando: Date.now(), quantos: 2, de: '2020-11-09', ate: '2022-11-11' }],
    lancamentos: [
      { id: 'f' + s, tipo: 'entrada', valor: 20000, descricao: 'a 11/11/2022', categoria: 'Outros', data: '2020-11-09', contaId: conta, importacaoId: imp },
      { id: 'p' + s, tipo: 'entrada', valor: 10000, descricao: 'Pix recebido de FULANO', categoria: 'Outros', data: '2021-05-05', contaId: conta, importacaoId: imp }
    ]
  };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await p2.click('#dialogoAcoes button:has-text("Restaurar")'); await p2.waitForTimeout(3000);
await p2.click('#navegacao button:has-text("Início")').catch(() => {}); await p2.waitForTimeout(1200);
const linhaConta = limpo(await p2.textContent('#telaInicio .linha-alvo:has-text("C6 Bank")'));
conferir('2. a entrada fantasma "a 11/11/2022" saiu e o saldo fica só com o Pix', /R\$ 100,00/.test(linhaConta) && !/300,00/.test(linhaConta), linhaConta);
await p2.click('#telaInicio .linha-alvo:has-text("C6 Bank")'); await p2.waitForTimeout(1000);
const fc = limpo(await p2.textContent('#folha'));
conferir('3. e o extrato fica com 1 lançamento', /extrato\.pdf · 1 lançamento\(s\)/.test(fc) && !/\+a 11\/11\/2022/.test(fc), (fc.match(/Extratos.{0,120}/) || [''])[0]);
await p2.screenshot({ path: dir + '/z81-c6-sem-fantasma.png' });

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

// Pagamento da fatura no banco ligado à fatura do cartão (pedido do Vitor
// em 19/11/2026). O extrato do banco é a verdade; as compras do cartão só
// dizem em que o dinheiro foi gasto. Ligados (mesmo valor, mesmo mês): a
// linha do banco ganha outra cor, mostra as categorias das compras e abre
// a fatura; os gastos contam pelas compras, sem dobrar. Sem a fatura,
// tudo volta a ser como era.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
let errosDePagina = 0;
page.on('pageerror', e => { errosDePagina++; console.log('PAGEERROR:', e.message); });
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.clock.setFixedTime(new Date(2026, 10, 19, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('finanz.privado', '0'); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t177-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const dados = { contas:[{ id: m + '-cartao', nome:'C6 Bank', tipo:'Cartão de crédito', saldoInicial:0, banco:'c6', fechamento:3, vencimento:10, limite:1000000 },
                          { id: m + '-inter', nome:'Banco Inter', tipo:'Conta corrente', saldoInicial:500000 }],
    lancamentos: [{ id: m + '-pag', tipo:'saida', valor:246235, descricao:'Boleto C6 Bank', categoria:'Outros', data:'2026-11-10', contaId: m + '-inter' },
                  { id: m + '-sal', tipo:'entrada', valor:500000, descricao:'Salário', categoria:'Salário', data:'2026-11-05', contaId: m + '-inter' }] };
  const f = new File([JSON.stringify({app:'finanz', dados})], 'b.json', {type:'application/json'});
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);

const transacoes = async () => {
  for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(500); }
  await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1200);
  return limpo(await page.textContent('#telaTransacoes'));
};

// Antes da fatura: o boleto é só uma saída do banco.
let t = await transacoes();
conferir('1. sem a fatura, o boleto é uma saída comum, em Outros', /Boleto C6 Bank\s*Outros/.test(t) && /Saídas\s*R\$ 2\.462,35/.test(t) &&
  !(await page.locator('#telaTransacoes .linha-fatura-ligada').count()));

// Importa a fatura no cartão.
page.on('filechooser', async fc => { await fc.setFiles(amostras + '/c6-fatura-quadros.pdf'); });
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
await page.click('#telaMais .linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .item-extrato', { timeout: 60000 }); await page.waitForTimeout(800);
const sel = page.locator('#folha select').first();
if (await sel.count()) { await sel.selectOption({ label: 'C6 Bank' }).catch(() => {}); await page.waitForTimeout(1200); }
await page.locator('#folha .btn-ouro:has-text("Importar")').first().click();
await page.waitForSelector('#dialogoFundo.aberta', { timeout: 30000 });
await page.locator('#dialogoAcoes button').nth(0).click(); await page.waitForTimeout(3000);

t = await transacoes();
const ligada = limpo(await page.textContent('#telaTransacoes .linha-fatura-ligada').catch(() => ''));
console.log('ligada:', ligada);
conferir('2. o boleto do banco reconhece a fatura: outra cor e as categorias das compras', /Boleto C6 Bank/.test(ligada) &&
  /Fatura C6 Bank · Outros, Alimentação, Moradia e mais 1/.test(ligada) && /ver a fatura/.test(ligada), ligada);
conferir('3. o gasto conta uma vez só: R$ 2.462,35 pelas compras, não o dobro', /Saídas\s*R\$ 2\.462,35/.test(t), (t.match(/Saídas\s*R\$ [\d.,]+/) || [''])[0]);
await page.screenshot({ path: dir + '/z104-boleto-ligado.png' });
await page.click('#telaTransacoes .linha-fatura-ligada'); await page.waitForTimeout(1200);
conferir('4. tocando, abre a fatura do cartão', /Fatura de novembro de 2026/.test(await page.textContent('#folhaTitulo')));

// Na distribuição de gastos do Início: as categorias das compras.
await page.goBack(); await page.waitForTimeout(600);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
const dist = limpo(await page.textContent('#telaInicio .cartao:has-text("Distribuição de gastos")').catch(() => ''));
conferir('5. a distribuição mostra as categorias das compras, não o boleto', /Outros/.test(dist) && /Alimentação/.test(dist) && /Moradia/.test(dist) && /Negócio/.test(dist), dist.slice(0, 200));

// Apagando as compras do cartão, volta a ser como era.
await page.click('#telaInicio .linha-alvo:has-text("C6 Bank")'); await page.waitForTimeout(1500);
await page.click('#folha .btn-perigo:has-text("Apagar todos os gastos")'); await page.waitForTimeout(700);
await page.click('#dialogoAcoes button:has-text("Apagar")'); await page.waitForTimeout(2000);
t = await transacoes();
conferir('6. sem a fatura, o boleto volta a ser saída comum, e o valor continua lá', /Boleto C6 Bank\s*Outros/.test(t) && /Saídas\s*R\$ 2\.462,35/.test(t) &&
  !(await page.locator('#telaTransacoes .linha-fatura-ligada').count()), (t.match(/Saídas\s*R\$ [\d.,]+/) || [''])[0]);

conferir('7. nenhum erro na página', errosDePagina === 0, errosDePagina);
console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

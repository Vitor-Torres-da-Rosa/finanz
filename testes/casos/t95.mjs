// O "Saldo do período" tem de somar o que está na tela.
//
// Antes, "Lançamentos" saía da lista filtrada e "Entradas"/"Saídas" saíam
// do período inteiro: o mesmo cartão dizia 2 lançamentos e somava os dez
// que estavam fora do filtro.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t95'+Date.now()+'-'+process.pid+'@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.evaluate(() => new Promise((res) => {
  const h = new Date();
  const d = (dia) => h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') +
                     '-' + String(dia).padStart(2, '0');
  const dados = {
    contas: [{ id: 'cc95', nome: 'C6 Bank', tipo: 'Conta corrente', saldoInicial: 1000000 }],
    lancamentos: [
      { id: 'e1', tipo: 'entrada', valor: 300000, data: d(2), contaId: 'cc95',
        categoria: 'Serviços', descricao: 'Serviço do mês' },
      { id: 'e2', tipo: 'entrada', valor: 100000, data: d(3), contaId: 'cc95',
        categoria: 'Vendas', descricao: 'Venda avulsa' },
      { id: 's1', tipo: 'saida', valor: 50000, data: d(4), contaId: 'cc95',
        categoria: 'Alimentação', subcategoria: 'Mercado', descricao: 'Mercado do mês' },
      { id: 's2', tipo: 'saida', valor: 20000, data: d(5), contaId: 'cc95',
        categoria: 'Transporte', subcategoria: 'Combustível', descricao: 'Posto' },
      { id: 's3', tipo: 'saida', valor: 30000, data: d(6), contaId: 'cc95',
        categoria: 'Moradia', subcategoria: 'Luz', descricao: 'Conta de luz' }
    ]
  };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1800);

const resumo = () => page.textContent('#listaTransacoes .cartao:has-text("Saldo do período")').then(limpo);

// --- tudo ---
const tudo = await resumo();
console.log('tudo:', tudo);
conferir('1. sem filtro, soma os cinco: R$ 4.000,00 de entrada e R$ 1.000,00 de saída',
  /R\$ 4\.000,00/.test(tudo) && /R\$ 1\.000,00/.test(tudo) && /Lançamentos5|Lançamentos 5/.test(tudo), tudo);
conferir('2. e o saldo é R$ 3.000,00', /R\$ 3\.000,00/.test(tudo));

// --- só receitas ---
await page.click('#telaTransacoes .seg-item:has-text("Receitas"), #telaTransacoes button:has-text("Receitas")');
await page.waitForTimeout(1400);
const soReceitas = await resumo();
console.log('só receitas:', soReceitas);
conferir('3. filtrando receitas, as saídas do resumo zeram',
  /R\$ 4\.000,00/.test(soReceitas) && /R\$ 0,00/.test(soReceitas) &&
  !/R\$ 1\.000,00/.test(soReceitas), soReceitas);
conferir('4. e ele avisa que está somando só o que está na lista',
  /Somando só o que está nesta lista: só receitas/.test(soReceitas));
await page.screenshot({ path: dir+'/r01-receitas.png', fullPage: true });

// --- só despesas ---
await page.click('#telaTransacoes .seg-item:has-text("Despesas"), #telaTransacoes button:has-text("Despesas")');
await page.waitForTimeout(1400);
const soDespesas = await resumo();
console.log('só despesas:', soDespesas);
conferir('5. filtrando despesas, as entradas zeram e o saldo fica negativo',
  /EntradasR\$ 0,00/.test(soDespesas) && /SaídasR\$ 1\.000,00/.test(soDespesas) &&
  /Saldo do período-?R\$ 1\.000,00/.test(soDespesas), soDespesas);
conferir('5b. o saldo de "só despesas" é o total gasto, e conta 3 lançamentos',
  /Lançamentos3|Lançamentos 3/.test(soDespesas), soDespesas.slice(-90));

// --- busca ---
await page.click('#telaTransacoes .seg-item:has-text("Todas"), #telaTransacoes button:has-text("Todas")');
// Espero o filtro cair de verdade antes de buscar, senão o rodapé sai
// falando de dois recortes e o teste mede outra coisa.
await page.waitForFunction(() => {
  var n = document.getElementById('listaTransacoes');
  return n && /Lançamentos\s*5/.test(n.textContent.replace(/\s+/g, ' '));
}, null, { timeout: 20000 });
await page.locator('#telaTransacoes .busca input').fill('Mercado');
await page.waitForFunction(() => {
  var n = document.getElementById('listaTransacoes');
  return n && /Lançamentos\s*1[^\d]/.test(n.textContent.replace(/\s+/g, ' '));
}, null, { timeout: 20000 });
await page.waitForTimeout(400);
const comBusca = await resumo();
console.log('busca:', comBusca);
conferir('6. buscando "Mercado", soma só o lançamento achado',
  /R\$ 500,00/.test(comBusca) && /Lançamentos1|Lançamentos 1/.test(comBusca), comBusca);
conferir('7. e o rodapé diz que a soma é só da busca',
  /busca por "Mercado"/.test(comBusca), comBusca.slice(-110));
await page.screenshot({ path: dir+'/r02-busca.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: o resumo soma o que está na tela');

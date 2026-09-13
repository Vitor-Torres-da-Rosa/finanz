// Categorias em dois andares.
//
// Prova três coisas: a lista antiga vira categoria + subcategoria sem
// perder nada, dá para escolher a subcategoria no lançamento, e dá para
// criar categoria e subcategoria novas na própria tela.
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t92'+Date.now()+'-'+process.pid+'@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folhaFechou = () => page.waitForFunction(
  () => !document.getElementById('folha').classList.contains('aberta'), null, { timeout: 20000 });

// Backup com os nomes da lista antiga, incluindo os que a pessoa tinha
// criado na mão. Um deles ("Barbearia da esquina") não está na tabela e
// tem de continuar sendo categoria dela.
await page.evaluate(() => new Promise((res) => {
  const h = new Date();
  const d = (dia) => h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') +
                     '-' + String(dia).padStart(2, '0');
  const dados = {
    contas: [{ id: 'cc92', nome: 'C6 Bank', tipo: 'Conta corrente', saldoInicial: 5000000 }],
    categoriasExtras: { saida: ['Custo Juridico', 'Barbearia', 'Barbearia da esquina'], entrada: [] },
    orcamentos: { geral: 0, categorias: { 'Mercado': 80000, 'Alimentação': 20000, 'Combustível': 50000 } },
    lancamentos: [
      { id: 'a1', tipo: 'saida', valor: 30000, data: d(3), contaId: 'cc92',
        categoria: 'Mercado', descricao: 'Compra do mês' },
      { id: 'a2', tipo: 'saida', valor: 20000, data: d(4), contaId: 'cc92',
        categoria: 'Combustível', descricao: 'Posto' },
      { id: 'a3', tipo: 'saida', valor: 15000, data: d(5), contaId: 'cc92',
        categoria: 'Custo Juridico', descricao: 'Advogado' },
      { id: 'a4', tipo: 'saida', valor: 8000, data: d(6), contaId: 'cc92',
        categoria: 'Barbearia da esquina', descricao: 'Corte' },
      { id: 'a5', tipo: 'entrada', valor: 400000, data: d(2), contaId: 'cc92',
        categoria: 'Uber', descricao: 'Corridas da semana' }
    ]
  };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);

// --- a migração ---
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1600);
const transacoes = limpo(await page.textContent('#telaTransacoes'));
console.log('transações:', transacoes.slice(0, 460));
conferir('1. "Mercado" virou Alimentação · Mercado', /Alimentação · Mercado/.test(transacoes));
conferir('2. "Combustível" virou Transporte · Combustível', /Transporte · Combustível/.test(transacoes));
conferir('3. "Custo Juridico" virou Negócio · Custo jurídico', /Negócio · Custo jurídico/.test(transacoes));
conferir('4. "Uber" virou Aplicativos · Uber', /Aplicativos · Uber/.test(transacoes));
conferir('5. categoria criada por ela e fora da tabela continua de pé',
  /Barbearia da esquina/.test(transacoes));
conferir('6. nenhum lançamento se perdeu',
  /Compra do mês/.test(transacoes) && /Posto/.test(transacoes) &&
  /Advogado/.test(transacoes) && /Corte/.test(transacoes) && /Corridas da semana/.test(transacoes));
await page.screenshot({ path: dir+'/u01-migrado.png', fullPage: true });

// --- o teto de orçamento seguiu junto e somou o que caiu no mesmo lugar ---
await page.click('#navegacao button:has-text("Planejar")'); await page.waitForTimeout(1600);
const planejar = limpo(await page.textContent('#telaPlanejamento'));
console.log('planejar:', planejar.slice(0, 300));
conferir('7. os tetos de Mercado e Alimentação viraram um só de R$ 1.000,00',
  /AlimentaçãoR\$ 300,00 \/ R\$ 1\.000,00/.test(planejar),
  (planejar.match(/Alimentação.{0,30}/) || ['?'])[0]);
conferir('8. o teto de Combustível virou teto de Transporte',
  /Transporte/.test(planejar) && /R\$ 500,00/.test(planejar));

// --- escolher subcategoria num lançamento novo ---
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
await page.click('#fab'); await page.waitForTimeout(1000);
const chipsCat = () => page.locator('#folha .campo:has-text("Categoria") .chips').first();
const chipsSub = () => page.locator('#folha .campo:has-text("Subcategoria") .chips').first();
const catsNaTela = await chipsCat().locator('.chip').allTextContents();
console.log('categorias na tela:', catsNaTela.join(', '));
conferir('9. a lista de cima ficou curta e com "+ Adicionar"',
  catsNaTela.length <= 16 && catsNaTela.indexOf('+ Adicionar') >= 0, String(catsNaTela.length));
conferir('10. "Mercado" não é mais categoria de cima', catsNaTela.indexOf('Mercado') < 0);

await page.locator('#folha input[inputmode=numeric]').first().fill('4500');
await page.locator('#folha input.entrada[type=text]').first().fill('Almoço do sábado');
await page.waitForTimeout(700);
await chipsCat().locator('.chip:has-text("Alimentação")').first().click(); await page.waitForTimeout(700);
const subsNaTela = await chipsSub().locator('.chip').allTextContents();
console.log('subcategorias de Alimentação:', subsNaTela.join(', '));
conferir('11. as subcategorias de Alimentação apareceram',
  subsNaTela.indexOf('Mercado') >= 0 && subsNaTela.indexOf('Restaurante') >= 0 &&
  subsNaTela.indexOf('Nenhuma') === 0);
await chipsSub().locator('.chip:has-text("Restaurante")').first().click(); await page.waitForTimeout(600);
await page.screenshot({ path: dir+'/u02-subcategoria.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar")'); await folhaFechou(); await page.waitForTimeout(1500);

await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1600);
const comSub = limpo(await page.textContent('#telaTransacoes'));
conferir('12. a linha mostra categoria e subcategoria',
  /Alimentação · Restaurante/.test(comSub), (comSub.match(/Almoço do sábado[^+]{0,60}/) || ['?'])[0]);

// --- criar subcategoria nova ---
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
await page.click('#fab'); await page.waitForTimeout(1000);
await page.locator('#folha input[inputmode=numeric]').first().fill('9000');
await page.locator('#folha input.entrada[type=text]').first().fill('Guincho do Zé');
await page.waitForTimeout(700);
await chipsCat().locator('.chip:has-text("Transporte")').first().click(); await page.waitForTimeout(700);
await chipsSub().locator('.chip-mais').click(); await page.waitForTimeout(1200);
conferir('13. abriu a folha de criar subcategoria',
  /Nova subcategoria/.test(await page.textContent('#folhaTitulo')));
await page.locator('#folha input.entrada[type=text]').first().fill('Guincho');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1600);
const depoisDeCriar = await chipsSub().locator('.chip[aria-pressed="true"]').allTextContents();
console.log('subcategoria escolhida:', depoisDeCriar.join(','));
conferir('14. a subcategoria nova já veio escolhida', depoisDeCriar.indexOf('Guincho') >= 0);
conferir('15. o valor digitado voltou com a folha',
  /90,00/.test(await page.locator('#folha input[inputmode=numeric]').first().inputValue()));
await page.screenshot({ path: dir+'/u03-criada.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar")'); await folhaFechou(); await page.waitForTimeout(1500);

// --- criar categoria nova pelo mesmo caminho ---
await page.click('#fab'); await page.waitForTimeout(1000);
await page.locator('#folha input[inputmode=numeric]').first().fill('3000');
await page.locator('#folha input.entrada[type=text]').first().fill('Dízimo');
await page.waitForTimeout(700);
await chipsCat().locator('.chip-mais').click(); await page.waitForTimeout(1400);
await page.locator('#folha input.entrada[type=text]').first().fill('Igreja');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
const catsDepois = await chipsCat().locator('.chip[aria-pressed="true"]').allTextContents();
conferir('16. a categoria nova já veio escolhida', catsDepois.indexOf('Igreja') >= 0, catsDepois.join(','));
const subsDaNova = await chipsSub().locator('.chip').allTextContents();
conferir('17. categoria nova começa só com "Nenhuma" e "+ Adicionar"',
  subsDaNova.length === 2 && subsDaNova[0] === 'Nenhuma', subsDaNova.join(','));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: categorias em dois andares, com migração e com "Adicionar"');

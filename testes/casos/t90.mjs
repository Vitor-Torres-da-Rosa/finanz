// Tocar numa fatia da rosca abre os lançamentos que formaram aquele número.
//
// O que a folha soma tem que bater com o que está escrito na legenda —
// inclusive em despesas, onde a fatura paga fica de fora da conta.
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t90'+Date.now()+'-'+process.pid+'@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

// Oito categorias de saída (seis cabem na rosca, duas viram "Demais"),
// duas de entrada, e um cartão com compra e fatura paga.
await page.evaluate(() => new Promise((res) => {
  const h = new Date();
  const d = (dia) => h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') +
                     '-' + String(dia).padStart(2, '0');
  const saida = (id, cat, valor, dia, desc) => ({
    id, tipo: 'saida', valor, data: d(dia), contaId: 'cc90', categoria: cat, descricao: desc });
  const dados = {
    contas: [
      { id: 'cc90', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 5000000 },
      { id: 'cx90', nome: 'Cartão Preto', tipo: 'Cartão de crédito', saldoInicial: 0 }
    ],
    lancamentos: [
      saida('a1', 'Alimentação', 30000, 3, 'Mercado do mês'),
      saida('a2', 'Alimentação', 12000, 9, 'Feira'),
      saida('a3', 'Alimentação', 8000, 14, 'Padaria'),
      saida('b1', 'Moradia', 40000, 5, 'Aluguel'),
      saida('c1', 'Transporte', 25000, 6, 'Combustível'),
      saida('e1', 'Lazer', 20000, 7, 'Cinema'),
      saida('f1', 'Saúde', 15000, 8, 'Farmácia'),
      saida('g1', 'Educação', 10000, 10, 'Curso'),
      saida('h1', 'Impostos', 5000, 11, 'DAS'),
      saida('i1', 'Custo operacional', 3000, 12, 'Taxa'),
      { id: 'k1', tipo: 'saida', valor: 18000, data: d(2), contaId: 'cx90',
        categoria: 'Outros', descricao: 'Compra no cartão' },
      { id: 'k2', tipo: 'saida', valor: 18000, data: d(15), contaId: 'cc90',
        categoria: 'Pagamento Fatura', descricao: 'Pagamento fatura cartão' },
      { id: 'r1', tipo: 'entrada', valor: 500000, data: d(4), contaId: 'cc90',
        categoria: 'Serviços', descricao: 'Serviço do mês' },
      { id: 'r2', tipo: 'entrada', valor: 150000, data: d(13), contaId: 'cc90',
        categoria: 'Venda', descricao: 'Venda de peça' }
    ]
  };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1600);

// O título do cartão muda com o lado escolhido: gastos ou receitas.
const cartaoGastos = () => page.locator('#telaInicio .cartao', { hasText: /Distribuição de (gastos|receitas)/ });
const fatia = (nome) => cartaoGastos().locator('.legenda-alvo', { hasText: nome }).first();
const folhaFechou = () => page.waitForFunction(
  () => !document.getElementById('folha').classList.contains('aberta'), null, { timeout: 20000 });

const legendaToda = limpo(await cartaoGastos().textContent());
console.log('legenda:', legendaToda.slice(0, 260));
conferir('1. a fatura paga não entra nos gastos', !/Pagamento Fatura/.test(legendaToda));

// --- uma categoria ---
await fatia('Alimentação').click(); await page.waitForTimeout(1400);
const alim = limpo(await page.textContent('#folha'));
console.log('folha Alimentação:', alim.slice(0, 220));
conferir('2. a folha abre no nome da categoria', /Alimentação/.test(await page.textContent('#folhaTitulo')));
conferir('3. soma os R$ 500,00 da categoria', /R\$ 500,00/.test(alim), alim.slice(0, 60));
conferir('4. diz quantos lançamentos são', /3 lançamentos/.test(alim));
conferir('5. lista os três', /Mercado do mês/.test(alim) && /Feira/.test(alim) && /Padaria/.test(alim));
conferir('6. não traz lançamento de outra categoria', !/Aluguel/.test(alim) && !/Combustível/.test(alim));
await page.screenshot({ path: dir+'/w01-categoria.png', fullPage: true });
await page.goBack(); await folhaFechou();
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1400);

// --- "Demais" junta o resto ---
await fatia('Demais').click(); await page.waitForTimeout(1400);
const demais = limpo(await page.textContent('#folha'));
console.log('folha Demais:', demais.slice(0, 260));
conferir('7. "Demais" soma R$ 180,00 (Educação + Impostos e taxas + Negócio)',
  /R\$ 180,00/.test(demais), demais.slice(0, 60));
conferir('8. diz que categorias juntou',
  /Junta 3 categorias/.test(demais) && /Educação, Impostos e taxas, Negócio/.test(demais));
conferir('9. traz os lançamentos das três',
  /Curso/.test(demais) && /DAS/.test(demais) && /Taxa/.test(demais));
await page.screenshot({ path: dir+'/w02-demais.png', fullPage: true });
await page.goBack(); await folhaFechou();
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1400);

// --- do lado das receitas ---
await cartaoGastos().locator('.seg-item:has-text("Receitas"), button:has-text("Receitas")').first().click();
await page.waitForTimeout(1400);
await fatia('Serviços').click(); await page.waitForTimeout(1400);
const rec = limpo(await page.textContent('#folha'));
console.log('folha Serviços:', rec.slice(0, 200));
conferir('10. do lado das receitas, abre o que entrou', /Recebido/.test(rec) && /R\$ 5\.000,00/.test(rec), rec.slice(0, 60));
conferir('11. é o lançamento de entrada certo', /Serviço do mês/.test(rec) && !/Venda de peça/.test(rec));
await page.screenshot({ path: dir+'/w03-receita.png', fullPage: true });

// --- tocar numa linha abre o lançamento para editar ---
await page.click('#folha .linha:has-text("Serviço do mês")'); await page.waitForTimeout(1400);
const titulo = limpo(await page.textContent('#folhaTitulo'));
const descricao = await page.locator('#folha .campo:has-text("Descrição") input').inputValue();
conferir('12. a linha leva para o lançamento',
  /Editar lançamento/.test(titulo) && descricao === 'Serviço do mês', titulo + ' · ' + descricao);

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: a fatia da rosca abre o que a formou');

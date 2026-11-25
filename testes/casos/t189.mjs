// Pedidos do Vitor em 25/11/2026: a carteira (dinheiro físico) também mostra
// os dias; e os dias contam pela data, não por 24 horas: atualizado dia 25
// às 23h50, dez minutos depois, no dia 26, já é "1 dia".
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.clock.setFixedTime(new Date(2026, 10, 25, 23, 50, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('finanz.privado', '0'); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t189-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const dados = {
    contas: [{ id: m + 'in', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 },
             { id: m + 'ca', nome: 'Carteira', tipo: 'Dinheiro físico', saldoInicial: 0 }],
    importacoes: [{ id: m + 'i1', contaId: m + 'in', banco: 'X', arquivo: 'a.pdf', quando: Date.now(), quantos: 1, de: '2026-11-01', ate: '2026-11-25' }],
    lancamentos: [{ id: m + 'a', tipo: 'saida', valor: 1000, descricao: 'Compra', categoria: 'Outros', data: '2026-11-25', contaId: m + 'in', importacaoId: m + 'i1' },
                  { id: m + 'b', tipo: 'entrada', valor: 270000, descricao: 'Ninja 250r 2012', categoria: 'Vendas', data: '2026-11-25', contaId: m + 'ca' },
                  { id: m + 'c', tipo: 'saida', valor: 5000, descricao: 'Agendado', categoria: 'Outros', data: '2026-12-20', contaId: m + 'ca' }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1200);
const contas = page.locator('#telaInicio .cartao', { has: page.locator('.linha-titulo', { hasText: 'Total em contas' }) });
const idade = async (nome) => limpo(await contas.locator('.linha', { hasText: nome }).first().locator('.idade-extrato').textContent().catch(() => ''));
conferir('1. dia 25 às 23h50: o Inter e a carteira atualizados hoje', (await idade('Banco Inter')) === 'hoje' && (await idade('Carteira')) === 'hoje', (await idade('Banco Inter')) + ' / ' + (await idade('Carteira')));
await contas.screenshot({ path: dir + '/z127-carteira-dias.png' });

await page.clock.setFixedTime(new Date(2026, 10, 26, 0, 10, 0));
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1200);
conferir('2. dez minutos depois, já no dia 26: "1 dia" nos dois', (await idade('Banco Inter')) === '1 dia' && (await idade('Carteira')) === '1 dia', (await idade('Banco Inter')) + ' / ' + (await idade('Carteira')));

await page.clock.setFixedTime(new Date(2026, 11, 3, 9, 0, 0));
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1200);
conferir('3. dia 3/12: 8 dias, e o lançamento agendado para 20/12 não conta', (await idade('Carteira')) === '8 dias', await idade('Carteira'));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

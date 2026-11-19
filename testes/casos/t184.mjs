// Pedidos do Vitor em 19/11/2026: (1) conta de dinheiro físico não tem
// "Importar extrato"; (2) "Ajustar saldo": digita o saldo certo e escolhe
// mudar o saldo inicial ou lançar a diferença como receita ou despesa.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t184-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const dados = {
    contas: [{ id: m + 'cart', nome: 'Carteira', tipo: 'Dinheiro físico', saldoInicial: 0 },
             { id: m + 'in', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 10000 }],
    lancamentos: [{ id: m + 'a', tipo: 'entrada', valor: 270000, descricao: 'Ninja 250r 2012', categoria: 'Vendas', data: '2026-11-07', contaId: m + 'cart' }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
const contas = page.locator('#telaInicio .cartao', { has: page.locator('.linha-titulo', { hasText: 'Total em contas' }) });
const saldoDe = async (nome) => limpo(await contas.locator('.linha', { hasText: nome }).first().locator('.linha-valor').textContent());

await contas.locator('.linha-alvo', { hasText: 'Carteira' }).click(); await page.waitForTimeout(1200);
conferir('1. a carteira (dinheiro físico) não tem "Extratos" nem "+ Importar"',
  (await page.locator('#folha .cartao-extratos').count()) === 0 && (await page.locator('#folha button:has-text("+ Importar")').count()) === 0);
await page.screenshot({ path: dir + '/z115-carteira-sem-extrato.png' });

// Ajusta para R$ 2.400,00: lança uma despesa de R$ 300,00.
await page.click('#folha button:has-text("Ajustar saldo")'); await page.waitForTimeout(900);
const campoSaldo = page.locator('#folha .campo-saldo-certo');
await campoSaldo.evaluate(n => { n.value = '240000'; n.dispatchEvent(new Event('input')); }); await page.waitForTimeout(300);
const dif = limpo(await page.textContent('#folha .diferenca-ajuste'));
conferir('2. mostra a diferença', /R\$ 300,00 a menos do que o app mostra/.test(dif), dif);
await page.screenshot({ path: dir + '/z116-ajustar-saldo.png' });
await page.click('#folha button:has-text("Continuar")'); await page.waitForTimeout(800);
const ops = limpo(await page.textContent('#escolhaLista').catch(() => ''));
conferir('3. pergunta: lançar a despesa ou mudar o saldo inicial', /Lançar uma despesa de R\$ 300,00/.test(ops) && /Mudar o saldo inicial.*De R\$ 0,00 para -R\$ 300,00/.test(ops), ops);
await page.screenshot({ path: dir + '/z117-como-ajustar.png' });
await page.click('#escolhaLista .escolha-item:has-text("Lançar uma despesa")'); await page.waitForTimeout(1200);
const form = limpo(await page.textContent('#folha').catch(() => ''));
conferir('4. abre a despesa preenchida para completar', /Nova despesa/.test(form) && (await page.$$eval('#folha input', ns => ns.map(n => n.value).join('|'))).includes('300,00') && (await page.$$eval('#folha input', ns => ns.map(n => n.value))).includes('Ajuste de saldo'), form.slice(0, 80));
await page.screenshot({ path: dir + '/z118-despesa-do-ajuste.png' });
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
conferir('5. a carteira fica com R$ 2.400,00', (await saldoDe('Carteira')) === 'R$ 2.400,00', await saldoDe('Carteira'));

// No Inter, ajusta o saldo inicial: R$ 100,00 → R$ 250,00.
await contas.locator('.linha-alvo', { hasText: 'Banco Inter' }).click(); await page.waitForTimeout(1200);
conferir('6. a conta do banco continua com "Extratos"', (await page.locator('#folha .cartao-extratos').count()) === 1);
await page.click('#folha button:has-text("Ajustar saldo")'); await page.waitForTimeout(900);
await campoSaldo.evaluate(n => { n.value = '25000'; n.dispatchEvent(new Event('input')); }); await page.waitForTimeout(300);
await page.click('#folha button:has-text("Continuar")'); await page.waitForTimeout(800);
await page.click('#escolhaLista .escolha-item:has-text("Mudar o saldo inicial")'); await page.waitForTimeout(1500);
const nota = limpo(await page.textContent('#folha .linha-nota').catch(() => ''));
conferir('7. mudou o saldo inicial, sem lançamento novo', /saldo inicial de R\$ 250,00/.test(nota), nota);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1000);
conferir('8. o Inter fica com R$ 250,00', (await saldoDe('Banco Inter')) === 'R$ 250,00', await saldoDe('Banco Inter'));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

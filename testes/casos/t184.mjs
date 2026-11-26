// Pedidos do Vitor em 19/11/2026: (1) conta de dinheiro físico não tem
// "Importar extrato". E em 26/11/2026: (2) o saldo se corrige tocando nele;
// a diferença vira uma receita (a mais) ou despesa (a menos) para completar,
// e sair sem salvar não muda nada. "Ajustar saldo" e "Editar esta conta"
// saíram do painel.
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

// Corrige para R$ 2.400,00: vira uma despesa de R$ 300,00.
await page.evaluate(() => { const b = document.querySelector('#folha .botao-saldo-correto'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }); await page.waitForTimeout(400);
conferir('2. o painel não tem mais "Ajustar saldo" nem "Editar esta conta"',
  (await page.locator('#folha button:has-text("Ajustar saldo")').count()) === 0 && (await page.locator('#folha button:has-text("Editar esta conta")').count()) === 0);
await page.click('#folha .saldo-editavel'); await page.waitForTimeout(500);
const campoSaldo = page.locator('#folha .campo-saldo-certo');
await campoSaldo.evaluate(n => { n.value = '240000'; n.dispatchEvent(new Event('input')); }); await page.waitForTimeout(300);
const dif = limpo(await page.textContent('#folha .diferenca-ajuste'));
conferir('3. tocando no saldo, dá para digitar o certo e ele mostra a diferença', /R\$ 300,00 a menos: vira uma despesa/.test(dif), dif);
await page.screenshot({ path: dir + '/z116-ajustar-saldo.png' });
await page.click('#folha .botao-saldo-continuar'); await page.waitForTimeout(1200);
const form = limpo(await page.textContent('#folha').catch(() => ''));
conferir('4. abre a despesa com a diferença, para completar', /Nova despesa/.test(form) && (await page.$$eval('#folha input', ns => ns.map(n => n.value).join('|'))).includes('300,00'), form.slice(0, 80));
await page.screenshot({ path: dir + '/z118-despesa-do-ajuste.png' });
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
conferir('5. salvando a despesa, a carteira fica com R$ 2.400,00', (await saldoDe('Carteira')) === 'R$ 2.400,00', await saldoDe('Carteira'));

// No Inter: corrige para R$ 250,00 (a mais) e desiste da receita.
await contas.locator('.linha-alvo', { hasText: 'Banco Inter' }).click(); await page.waitForTimeout(1200);
conferir('6. a conta do banco continua com "Extratos"', (await page.locator('#folha .cartao-extratos').count()) === 1);
await page.click('#folha .saldo-editavel'); await page.waitForTimeout(500);
await campoSaldo.evaluate(n => { n.value = '25000'; n.dispatchEvent(new Event('input')); }); await page.waitForTimeout(300);
const dif2 = limpo(await page.textContent('#folha .diferenca-ajuste'));
await page.click('#folha .botao-saldo-continuar'); await page.waitForTimeout(1200);
const form2 = limpo(await page.textContent('#folha').catch(() => ''));
conferir('7. a mais vira uma receita para completar', /R\$ 150,00 a mais: vira uma receita/.test(dif2) && /Nova receita/.test(form2), dif2 + ' | ' + form2.slice(0, 40));
for (let i = 0; i < 4 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
await page.click('#dialogoAcoes button:has-text("Descartar")').catch(() => {}); await page.waitForTimeout(600);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1000);
conferir('8. saindo sem salvar a receita, o saldo não muda', (await saldoDe('Banco Inter')) === 'R$ 100,00', await saldoDe('Banco Inter'));

// Cancelar a correção devolve o saldo como estava.
await contas.locator('.linha-alvo', { hasText: 'Banco Inter' }).click(); await page.waitForTimeout(1200);
await page.click('#folha .saldo-editavel'); await page.waitForTimeout(500);
await page.click('#folha .botao-saldo-cancelar'); await page.waitForTimeout(400);
const saldoTela = limpo(await page.textContent('#folha .saldo-editavel').catch(() => ''));
conferir('9. "Cancelar" volta a mostrar o saldo, sem mudar nada', /R\$ 100,00/.test(saldoTela) && (await page.locator('#folha .campo-saldo-certo').count()) === 0, saldoTela);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

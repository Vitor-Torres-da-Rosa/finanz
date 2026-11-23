// Ajustar saldo compara com o saldo de hoje: o aluguel agendado para daqui
// a 20 dias ainda não saiu do banco e não pode virar diferença (proposta 0013).
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t185-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const dados = {
    contas: [{ id: m + 'in', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 200000 }],
    lancamentos: [{ id: m + 'a', tipo: 'saida', valor: 12000, descricao: 'Posto', categoria: 'Transporte', data: '2026-11-13', contaId: m + 'in' },
                  { id: m + 'b', tipo: 'saida', valor: 45000, descricao: 'Aluguel agendado', categoria: 'Moradia', data: '2026-12-09', contaId: m + 'in' }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
await page.click('#telaInicio .linha-alvo:has-text("Banco Inter")'); await page.waitForTimeout(1200);
await page.click('#folha button:has-text("Ajustar saldo")'); await page.waitForTimeout(900);
const topo = limpo(await page.textContent('#folha .forma .cartao'));
conferir('1. mostra o saldo de hoje, sem o aluguel agendado', /Saldo no app hoje\s*R\$ 1\.880,00/.test(topo), topo.slice(0, 60));
conferir('2. diz o que ficou de fora', /1 lançamento\(s\) com data à frente \(− R\$ 450,00\)/.test(topo) && /fica em R\$ 1\.430,00/.test(topo), topo);
const campoSaldo = page.locator('#folha .campo-saldo-certo');
conferir('3. o campo já vem com o saldo de hoje', limpo((await campoSaldo.inputValue()).replace(/\u00a0/g, ' ')) === 'R$ 1.880,00', await campoSaldo.inputValue());
const dif = limpo(await page.textContent('#folha .diferenca-ajuste'));
conferir('4. com o saldo do banco, nada para ajustar', /nada para ajustar/.test(dif), dif);
await campoSaldo.evaluate(n => { n.value = '190000'; n.dispatchEvent(new Event('input')); });
await page.click('#folha button:has-text("Continuar")'); await page.waitForTimeout(800);
const ops = limpo(await page.textContent('#escolhaLista').catch(() => ''));
conferir('5. a diferença é só a de verdade (R$ 20,00)', /Lançar uma receita de R\$ 20,00/.test(ops) && /para R\$ 2\.020,00/.test(ops), ops.slice(0, 200));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

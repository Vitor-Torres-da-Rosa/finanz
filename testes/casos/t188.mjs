// Pedido do Vitor em 25/11/2026: os avisos de "X dias sem extrato" viram
// um só, com uma linha por banco (nome, data do último lançamento e dias).
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.clock.setFixedTime(new Date(2026, 10, 25, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('finanz.privado', '0'); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t188-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const conta = (id, nome) => ({ id: m + id, nome, tipo: 'Conta corrente', saldoInicial: 0 });
  const imp = (id, c, ate) => ({ id: m + id, contaId: m + c, banco: 'X', arquivo: id + '.pdf', quando: Date.now(), quantos: 1, de: '2026-11-01', ate });
  const L = (id, c, data, i) => ({ id: m + id, tipo: 'saida', valor: 1000, descricao: 'Compra ' + id, categoria: 'Outros', data, contaId: m + c, importacaoId: m + i });
  const dados = {
    contas: [conta('in', 'Banco Inter'), conta('c6', 'C6 Bank'), conta('it', 'Itaú'), conta('br', 'Bradesco'), conta('nu', 'Nubank')],
    importacoes: [imp('i1', 'in', '2026-11-17'), imp('i2', 'c6', '2026-11-18'), imp('i3', 'it', '2026-11-18'), imp('i4', 'br', '2026-11-18'), imp('i5', 'nu', '2026-11-23')],
    lancamentos: [L('a', 'in', '2026-11-17', 'i1'), L('b', 'c6', '2026-11-18', 'i2'), L('c', 'it', '2026-11-18', 'i3'), L('d', 'br', '2026-11-18', 'i4'), L('e', 'nu', '2026-11-23', 'i5')] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1200);
await page.click('#telaInicio .marca-sino');
await page.waitForFunction(() => /sem extrato/.test(document.getElementById('folha').textContent), null, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(800);
const tudo = limpo(await page.textContent('#folha'));
const n = (tudo.match(/sem extrato/g) || []).length;
conferir('1. um aviso só para os bancos parados', n === 1 && /4 bancos sem extrato atualizado\s*até 8 dias/.test(tudo), n + ' · ' + (tudo.match(/.{0,10}sem extrato.{0,40}/) || [''])[0]);
const linhas = await page.$$eval('#folha .achado-detalhes .achado-linha', ns => ns.map(n => [...n.children].map(x => x.textContent.trim()).join(' ').replace(/\s+/g, ' ')));
console.log('linhas:', linhas.join(' | '));
conferir('2. uma linha por banco, o mais atrasado primeiro, com a data e os dias',
  linhas.join(' | ') === 'Banco Inter · 17/11/2026 8 dias | Bradesco · 18/11/2026 7 dias | C6 Bank · 18/11/2026 7 dias | Itaú · 18/11/2026 7 dias', linhas.join(' | '));
conferir('3. o Nubank em dia (2 dias) fica de fora', !/Nubank/.test(tudo));
conferir('4. continua com o botão de importar', (await page.locator('#folha .btn-acao:has-text("Importar extrato")').count()) === 1);
const aviso = page.locator('#folha .achado', { hasText: 'sem extrato' }).first();
await aviso.scrollIntoViewIfNeeded().catch(() => {});
await aviso.screenshot({ path: dir + '/z126-extratos-parados.png' }).catch(async () => page.screenshot({ path: dir + '/z126-extratos-parados.png' }));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

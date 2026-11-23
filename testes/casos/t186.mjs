// Pedido do Vitor em 23/11/2026: na parcela, "Cliente não pagou" — cobrar
// juros (em % ou valor fixo, agora ou na próxima parcela, e se for agora
// oferecer a mensagem), mandar a cobrança, ou dar como perdida.
import { chromium, dir, ENDERECO, irParaClientes } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const parcelas = () => page.$$eval('#folha .lista-parcelas .linha', ns => ns.map(n => n.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()));
const abertos = [];
await page.exposeFunction('__abriu', (u) => abertos.push(u));
await page.addInitScript(() => { window.open = (u) => { window.__abriu(String(u)); return null; }; });

await page.clock.setFixedTime(new Date(2026, 10, 23, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t186-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Diversos de R$ 500,00 em 4x de R$ 125,00; as duas primeiras pagas.
await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const cli = m + 'cli', sv = m + 'sv';
  const P = (n, venc) => ({ id: m + 'p' + n, clienteId: cli, servicoId: sv, numero: n, total: 4, valor: 12500, vencimento: venc, minimo: 0, jurosAtraso: 0, quitadaEm: '', pagamentoId: '', criadoEm: n });
  const dados = {
    contas: [{ id: m + 'cc', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 }],
    clientes: [{ id: cli, nome: 'Fabiano Silva', telefones: [{ numero: '51999998888', whats: true }] }],
    servicos: [{ id: sv, clienteId: cli, nome: 'Diversos (grama, alvenaria etc)', tipo: 'Serviço', valor: 50000, data: '2026-08-10', obs: '' }],
    parcelas: [P(1, '2026-09-10'), P(2, '2026-10-10'), P(3, '2026-11-10'), P(4, '2026-12-10')],
    pagamentos: [{ id: m + 'g1', clienteId: cli, servicoId: sv, valor: 12500, data: '2026-09-10', parcelaId: m + 'p1' },
                 { id: m + 'g2', clienteId: cli, servicoId: sv, valor: 12500, data: '2026-10-10', parcelaId: m + 'p2' }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await irParaClientes(page);
const fecharTudo = async () => { for (let i = 0; i < 5 && (await page.locator('#cortina.aberta').count()); i++) { await page.goBack().catch(() => {}); await page.waitForTimeout(600); } };
const abrirFicha = async () => {
  await page.click('#telaInicio .linha-alvo:has-text("Fabiano")'); await page.waitForTimeout(1000);
  if (await page.locator('#folha button:has-text("Abrir a ficha do cliente")').count()) { await page.click('#folha button:has-text("Abrir a ficha do cliente")'); await page.waitForTimeout(1000); }
  const aba = page.locator('#folha .aba-cliente button:has-text("Parcelas"), #folha button.aba-cliente:has-text("Parcelas")');
  if (await aba.count()) { await aba.first().click(); await page.waitForTimeout(800); }
};
await abrirFicha();
console.log('parcelas:', (await parcelas()).join(' | '));
const abrirParcela = async (n) => { await page.click('#folha .lista-parcelas .linha:has-text("Parcela ' + n + ' de 4")'); await page.waitForTimeout(900); };
await abrirParcela(3);
conferir('1. a parcela em aberto tem "Cliente não pagou"', (await page.locator('#folha .botao-nao-pagou').count()) === 1);
await page.screenshot({ path: dir + '/z119-parcela-nao-pagou.png' });
await page.click('#folha .botao-nao-pagou'); await page.waitForTimeout(700);
const ops = limpo(await page.textContent('#escolhaLista').catch(() => ''));
conferir('2. oferece juros/multa, cobrança e "não vai pagar"', /Cobrar juros ou multa/.test(ops) && /Mandar a cobrança no WhatsApp/.test(ops) && /Não vai pagar\s*Os R\$ 125,00/.test(ops), ops);
await page.screenshot({ path: dir + '/z120-nao-pagou-opcoes.png' });

// ---- 10% agora: a parcela 3 vai a R$ 137,50 e oferece a mensagem ----
await page.click('#escolhaLista .escolha-item:has-text("Cobrar juros ou multa")'); await page.waitForTimeout(1000);
await page.fill('#folha .campo-juros-pct', '10'); await page.waitForTimeout(300);
const prev = limpo(await page.textContent('#folha .previa-juros'));
conferir('3. a prévia mostra o novo valor', /R\$ 12,50 a mais\. A parcela 3 de 4 \(10\/11\/2026\) passa de R\$ 125,00 para R\$ 137,50/.test(prev), prev);
await page.screenshot({ path: dir + '/z121-cobrar-juros.png' });
await page.click('#folha .btn-ouro:has-text("Cobrar")'); await page.waitForTimeout(1200);
const perg = limpo(await page.textContent('#dialogoFundo').catch(() => ''));
conferir('4. cobrando agora, pergunta se manda mensagem', /Mandar mensagem para Fabiano\?/.test(perg), perg.slice(0, 120));
await page.click('#dialogoAcoes button:has-text("Abrir o WhatsApp")'); await page.waitForTimeout(800);
const msg = decodeURIComponent((abertos[0] || '').split('text=')[1] || '');
conferir('5. a mensagem fala da parcela, dos juros e do novo valor', /wa\.me\/5551999998888/.test(abertos[0] || '') && /parcela 3\/4/.test(msg) && /R\$\s12,50 de juros/.test(msg) && /ficou em R\$\s137,50/.test(msg), msg.replace(/\n/g, ' ').slice(0, 200));
await page.goto('about:blank').catch(() => {});
await page.goBack().catch(() => {}); await page.waitForTimeout(1500);
await fecharTudo(); await irParaClientes(page); await abrirFicha();
let ls = await parcelas();
console.log('depois dos juros:', ls.join(' | '));
conferir('6. a parcela 3 fica em R$ 137,50 e a 4 continua em R$ 125,00', ls.some(l => /Parcela 3 de 4.*137,50/.test(l)) && ls.some(l => /Parcela 4 de 4.*125,00/.test(l)), ls.join(' | '));
const ficha = limpo(await page.textContent('#folha'));
conferir('7. o cliente passa a dever R$ 262,50', /262,50/.test(ficha), (ficha.match(/Falta[^R]*R\$ [\d.,]+/) || [''])[0]);

// ---- multa fixa de R$ 20,00 na próxima ----
await abrirParcela(3);
await page.click('#folha .botao-nao-pagou'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Cobrar juros ou multa")'); await page.waitForTimeout(1000);
await page.click('#folha .segmentos button:has-text("Valor fixo")'); await page.waitForTimeout(200);
await page.locator('#folha .campo-juros-fixo').evaluate(n => { n.value = '2000'; n.dispatchEvent(new Event('input')); });
await page.click('#folha .segmentos button:has-text("Na próxima")'); await page.waitForTimeout(300);
const prev2 = limpo(await page.textContent('#folha .previa-juros'));
conferir('8. na próxima: a parcela 4 é que cresce', /R\$ 20,00 a mais\. A parcela 4 de 4 \(10\/12\/2026\) passa de R\$ 125,00 para R\$ 145,00/.test(prev2), prev2);
await page.click('#folha .btn-ouro:has-text("Cobrar")'); await page.waitForTimeout(1500);
conferir('9. na próxima, não pergunta da mensagem', !(await page.locator('#dialogoFundo.aberta').count()));
await fecharTudo(); await irParaClientes(page); await abrirFicha();
ls = await parcelas();
conferir('10. parcela 4 em R$ 145,00', ls.some(l => /Parcela 4 de 4.*145,00/.test(l)), ls.join(' | '));

// ---- não vai pagar a parcela 3 ----
await abrirParcela(3);
await page.click('#folha .botao-nao-pagou'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Não vai pagar")'); await page.waitForTimeout(1200);
const p3 = limpo(await page.textContent('#dialogoFundo').catch(() => ''));
conferir('11. confirma dizendo quanto sai e como o registro fica', /deixa de dever R\$ 137,50/.test(p3) && /passa de R\$ 500,00 para R\$ 362,50/.test(p3), p3.slice(0, 220));
await page.screenshot({ path: dir + '/z122-nao-vai-pagar.png' });
await page.click('#dialogoAcoes button:has-text("Não vai pagar")'); await page.waitForTimeout(1800);
await fecharTudo(); await irParaClientes(page); await abrirFicha();
ls = await parcelas();
const ficha2 = limpo(await page.textContent('#folha'));
console.log('depois de perdida:', ls.join(' | '));
conferir('12. a parcela 3 sai; a 4 (R$ 145,00) fica', !ls.some(l => /137,50/.test(l)) && ls.some(l => /145,00/.test(l)), ls.join(' | '));
conferir('13. o cliente deve só a parcela 4: R$ 145,00', /145,00/.test(ficha2) && !/282,50|262,50/.test(ficha2), (ficha2.match(/Falta[^R]*R\$ [\d.,]+/) || [''])[0]);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

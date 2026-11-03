// "Falta" da ficha tem de bater com as parcelas.
//
// Print do Vitor em 03/11/2026 (Edison e Sander): em cima "Falta R$
// 39.000,00", nas parcelas "falta R$ 24.000,00". Duas causas juntas: o
// combinado de um registro ficou curto (parcelas pagas a menos sem a
// diferença virar parcela nova) e outro registro nunca teve parcelas.
// Agora o app completa o combinado curto e mostra o registro sem parcela.
import { chromium, dir, ENDERECO, irParaClientes } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t153-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const s = Date.now().toString(36);
  const d = (m, dia) => { const x = new Date(); x.setDate(1); x.setMonth(x.getMonth() + m); x.setDate(dia);
    return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  const cli = 'cli-' + s, sv = 'sv-' + s, obra = 'obra-' + s;
  const parc = (n, venc, quitada) => ({ id: 'p' + n + '-' + s, clienteId: cli, servicoId: sv, numero: n, total: 7, valor: 450000,
    vencimento: venc, minimo: 0, jurosAtraso: 0, quitadaEm: quitada || '', pagamentoId: '', criadoEm: Date.now() + n });
  const dados = {
    contas: [{ id: 'cc-' + s, nome: 'Banco', tipo: 'Conta corrente', saldoInicial: 0 }], lancamentos: [],
    clientes: [{ id: cli, nome: 'Edison e Sander', telefone: '51997308860', criadoEm: Date.now() }],
    servicos: [{ id: sv, clienteId: cli, nome: 'Investimento Life Sul', tipo: 'Serviço', valor: 3000000, data: d(-3, 2), obs: '', criadoEm: Date.now() },
               { id: obra, clienteId: cli, nome: 'Obra da garagem', tipo: 'Serviço', valor: 1500000, data: d(-1, 5), obs: '', criadoEm: Date.now() }],
    parcelas: [parc(1, d(-2, 10), d(-2, 2)), parc(2, d(-2, 10), d(-2, 10)), parc(3, d(-1, 10), d(-1, 2)),
               parc(4, d(1, 10)), parc(5, d(2, 10)), parc(6, d(3, 10)), parc(7, d(4, 10))],
    pagamentos: [
      { id: 'g1-' + s, clienteId: cli, servicoId: sv, parcelaId: 'p1-' + s, valor: 300000, data: d(-2, 2), lancamentoId: '', criadoEm: Date.now() },
      { id: 'g2-' + s, clienteId: cli, servicoId: sv, parcelaId: 'p2-' + s, valor: 150000, data: d(-2, 10), lancamentoId: '', criadoEm: Date.now() },
      { id: 'g3-' + s, clienteId: cli, servicoId: sv, parcelaId: 'p3-' + s, valor: 150000, data: d(-1, 2), lancamentoId: '', criadoEm: Date.now() }]
  };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);

await irParaClientes(page);
await page.click('#telaInicio .linha-alvo:has-text("Edison e Sander")'); await page.waitForTimeout(900);
const topo = limpo(await page.textContent('#folha'));
conferir('1. em cima: falta R$ 39.000,00', /Falta\s*R\$ 39\.000,00/i.test(topo), (topo.match(/Falta.{0,20}/i) || [''])[0]);
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(1200);
const ficha = limpo(await page.textContent('#folha'));
conferir('2. o combinado curto foi completado: falta R$ 24.000,00 no registro', /Investimento Life Sul · 3 de 9 paga\(s\) · falta R\$ 24\.000,00/.test(ficha),
  (ficha.match(/Investimento Life Sul ·.{0,50}/) || [''])[0]);
conferir('3. as parcelas novas vêm do mesmo tamanho, com a sobra na última',
  /Parcela 8 de 9.*R\$ 4\.500,00/.test(ficha) && /Parcela 9 de 9.*R\$ 1\.500,00/.test(ficha));
conferir('4. o registro sem parcela aparece com o que falta (R$ 15.000,00)',
  /Sem parcelas combinadas\s*\+?\s*Obra da garagem.*R\$ 15\.000,00/.test(ficha), (ficha.match(/Sem parcelas.{0,90}/) || [''])[0]);
conferir('5. não sobra desencontro para "Acertar"', !/Acertar as parcelas/.test(ficha));
await page.screenshot({ path: dir + '/z53-parcelas-completas.png', fullPage: true });
await page.click('#folha .cartao-sem-parcela .linha:has-text("Obra da garagem")'); await page.waitForTimeout(1200);
conferir('6. tocando, abre o combinar parcelas daquele registro', /Previsão de pagamento/.test(await page.textContent('#folhaTitulo')) &&
  /Obra da garagem/.test(limpo(await page.textContent('#folha'))));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: falta bate com as parcelas');

// Fatura do cartão (pedido do Vitor em 19/11/2026):
// 1) a fatura que venceu sem pagamento continua ocupando o limite; paga
//    (o pagamento aparece numa conta), deixa de ocupar;
// 2) "Parcela 4/6" quer dizer que faltam a 5/6 e a 6/6: o app pergunta em
//    cada compra e, se a pessoa quiser, lança nas próximas faturas.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.clock.setFixedTime(new Date(2026, 10, 19, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t176-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

const restaurar = async (comPagamento) => {
  await page.evaluate((comPagamento) => new Promise(res => {
    const m = Math.random().toString(36).slice(2, 8);
    const dados = { contas:[{ id: m + '-cartao', nome:'C6 Bank', tipo:'Cartão de crédito', saldoInicial:0, banco:'c6', fechamento:3, vencimento:10, limite:1000000 },
                            { id: m + '-inter', nome:'Banco Inter', tipo:'Conta corrente', saldoInicial:500000 }],
      lancamentos: comPagamento ? [{ id: m + '-pag', tipo:'saida', valor:246235, descricao:'Pagamento de fatura C6', categoria:'Financeiro', subcategoria:'Pagamento de fatura', data:'2026-11-10', contaId: m + '-inter' }] : [] };
    const f = new File([JSON.stringify({app:'finanz', dados})], 'b.json', {type:'application/json'});
    const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
    inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
  }), comPagamento);
  await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
};
const importar = async (ligar) => {
  page.removeAllListeners('filechooser');
  page.on('filechooser', async fc => { await fc.setFiles(amostras + '/c6-fatura-quadros.pdf'); });
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
  await page.click('#telaMais .linha:has-text("Importar extrato")');
  await page.waitForSelector('#folha .item-extrato', { timeout: 60000 }); await page.waitForTimeout(800);
  const sel = page.locator('#folha select').first();
  if (await sel.count()) { await sel.selectOption({ label: 'C6 Bank' }).catch(() => {}); await page.waitForTimeout(1200); }
  if (ligar) { await page.click('#folha .item-extrato:has-text("JIM.COM") .etiqueta-parcelas'); await page.waitForTimeout(700); }
};
const abrirCartao = async () => {
  for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(500); }
  await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
  await page.click('#telaInicio .linha-alvo:has-text("C6 Bank")'); await page.waitForTimeout(1500);
  return limpo(await page.textContent('#folha'));
};

// ---- sem pagamento: a de novembro venceu e ocupa o limite ----
await restaurar(false);
await importar(true);
const chips = await page.$$eval('#folha .item-extrato', ns => ns.map(n => {
  const ch = n.querySelector('.etiqueta-parcelas'); return n.querySelector('.item-desc').textContent.slice(0, 22) + ' => ' + (ch ? ch.textContent : '-'); }));
console.log(chips.join('\n'));
conferir('1. cada compra parcelada pergunta, com as parcelas que faltam; a última parcela não pergunta',
  chips.some(t => /MERCADOLIVRE.*lançar 12\/12 nas próximas faturas\?/.test(t)) && chips.some(t => /HAVAN.*=> -$/.test(t)) &&
  chips.some(t => /WEBER.*lançar 8\/12 a 12\/12/.test(t)) && chips.some(t => /JIM\.COM.*✓ lança 5\/6 a 6\/6 nas próximas faturas/.test(t)), chips.join(' | '));
await page.screenshot({ path: dir + '/z102-parcelas-pergunta.png' });
await page.locator('#folha .btn-ouro:has-text("Importar")').first().click();
await page.waitForSelector('#dialogoFundo.aberta', { timeout: 30000 });
const pergunta = limpo(await page.textContent('#dialogoFundo'));
conferir('2. a confirmação conta as parcelas futuras', /E mais 2 parcela\(s\) nas próximas faturas/.test(pergunta), pergunta.slice(0, 200));
await page.locator('#dialogoAcoes button').nth(0).click(); await page.waitForTimeout(3000);

let tela = await abrirCartao();
console.log(tela.slice(0, 700));
conferir('3. a fatura de novembro venceu sem pagamento e aparece em vermelho', /A fatura de novembro de 2026 \(R\$ 2\.462,35\) venceu em 10\/11\/2026 e não consta pagamento/.test(tela));
conferir('4. o limite conta ela e as parcelas futuras (2.462,35 + 2 × 2.180,55)', /R\$ 6\.823,45 em uso de R\$ 10\.000,00 · R\$ 3\.176,55 livre/.test(tela), (tela.match(/R\$ [\d.,]+ em uso.{0,40}/) || [''])[0]);
// Desde a 5.92 as faturas ficam mês a mês, numa faixa no topo.
const umMes = async (chave) => { await page.click('#folha .mes-fatura[data-chave="' + chave + '"]'); await page.waitForTimeout(500);
  return limpo(await page.textContent('#folha .cartao-faturas-mes')); };
const dez = await umMes('2026-12'), jan = await umMes('2027-01'), nov = await umMes('2026-11');
conferir('5. as parcelas 5/6 e 6/6 caem em dezembro e janeiro', /Parcela 5\/6/.test(dez) && /Parcela 6\/6/.test(jan) && /Fatura vencida, sem pagamento/.test(nov), dez.slice(0, 80) + ' | ' + jan.slice(0, 80));
await page.screenshot({ path: dir + '/z103-limite-vencida.png' });

// ---- com o pagamento na conta: a de novembro está paga ----
await restaurar(true);
await importar(false);
await page.locator('#folha .btn-ouro:has-text("Importar")').first().click();
await page.waitForSelector('#dialogoFundo.aberta', { timeout: 30000 });
await page.locator('#dialogoAcoes button').nth(0).click(); await page.waitForTimeout(3000);
tela = await abrirCartao();
conferir('6. com o pagamento de R$ 2.462,35 no Inter, novembro está paga e não ocupa o limite',
  !/não consta pagamento/.test(tela) && /R\$ 0,00 em uso de R\$ 10\.000,00/.test(tela) && /Fatura paga/.test(await umMes('2026-11')), (tela.match(/R\$ [\d.,]+ em uso.{0,40}/) || [''])[0]);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

// Fatura do C6 com os quadros de informação (pedido do Vitor em
// 18/11/2026): opções de pagamento, tabela de juros/IOF/CET, totais,
// subtotal de cada cartão, pagamento da fatura anterior e o rodapé do
// boleto viravam "compras". Fatura é só as compras dos cartões.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t175-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const dados = { contas:[{ id: m + '-cartao', nome:'C6 Bank', tipo:'Cartão de crédito', saldoInicial:0,
                            banco:'c6', fechamento:3, vencimento:10, limite:1000000 }], lancamentos:[] };
  const f = new File([JSON.stringify({app:'finanz', dados})], 'b.json', {type:'application/json'});
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);

page.on('filechooser', async fc => { await fc.setFiles(amostras + '/c6-fatura-quadros.pdf'); });
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
await page.click('#telaMais .linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .item-extrato', { timeout: 60000 }); await page.waitForTimeout(800);
const itens = await page.$$eval('#folha .item-extrato', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
console.log(itens.join('\n'));
const compras = ['MERCADOLIVRE', 'HAVAN VIAMAO - Parcela 10/10', 'HAVAN VIAMAO - Parcela 9/10', 'WEBER MOTO', 'SHOPEE', 'JIM.COM'];
conferir('1. as 6 compras dos cartões aparecem', compras.every(k => itens.some(t => t.includes(k))) && itens.length === 6, itens.length + ' itens');
const lixo = /Pagamento total|Parcelamento de fatura|Juros|CET|Entrada \+|IOF|Gastos desta fatura|Compras nacionais|Subtotal|Pag Fatura|Inclus.o de Pagamento|QR Code|^29 |Multa/i;
const sobrou = itens.filter(t => lixo.test(t));
conferir('2. nada dos quadros da fatura vira compra (opções de pagamento, juros, IOF, CET, totais, subtotal, pagamento anterior, QR Code)', sobrou.length === 0, sobrou.join(' | '));
const tela = limpo(await page.textContent('#folha'));
conferir('3. o que entra soma as compras da fatura', /Gastos R\$ 2\.562,34/.test(tela), (tela.match(/Gastos R\$ [\d.,]+/) || [''])[0]);
await page.screenshot({ path: dir + '/z101-fatura-so-compras.png' });
console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

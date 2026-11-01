import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
import { irParaClientes } from '../comum.mjs';
import { tocarFab } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
const folha = () => page.locator('#folha');
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1500);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('r'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await folha().locator('input.entrada[type=text]').first().fill('Carteira');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
await irParaClientes(page); await page.waitForTimeout(600);
await tocarFab(page); await page.waitForTimeout(700);
await folha().locator('input.entrada[type=text]').nth(0).fill('Cliente A');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(900);
await page.click('#telaInicio .linha-alvo:has-text("Cliente A")'); await page.waitForTimeout(900);
// registro de 54.000
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(800);
await folha().locator('input[inputmode=numeric]').first().fill('5400000');
await folha().locator('input.entrada[type=text]').first().fill('Obra grande');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(1100);

const parcelas = async () => page.$$eval('#folha .linha-alvo', ns => ns.map(n => n.textContent.replace(/\s+/g,' ')).filter(t=>/Parcela/.test(t)));
async function abrirPlano() {
  await page.click('#folha .btn-ouro:has-text("Previsão de pagamento"), #folha .btn:has-text("Previsão")').catch(()=>{});
}
// abre o parcelamento


console.log('1. campos:', await page.$$eval('#folha .campo > label', ns=>ns.map(x=>x.textContent)));
console.log('   seletores:', await page.$$eval('#folha .selecao', ns=>ns.map(x=>x.textContent.replace(/\s+/g,' '))));
console.log('   numéricos:', await page.$$eval('#folha input[inputmode=numeric]', ns=>ns.map(x=>x.value)));
// 12x
await page.click('#folha .selecao >> nth=1'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("12x")'); await page.waitForTimeout(900);
console.log('2. resumo 12x:', (await page.textContent('#folha .cartao')).replace(/\s+/g,' ').slice(0,90));
// agora pelo valor da parcela: 6.000
await folha().locator('input[inputmode=numeric]').nth(1).fill('600000');
await page.waitForTimeout(900);
console.log('3. por parcela 6.000:', (await page.textContent('#folha .cartao')).replace(/\s+/g,' ').slice(0,90));
console.log('   vezes virou:', await page.textContent('#folha .selecao >> nth=1'));
// valor quebrado: 5.000 -> 10x5000 + 4000
await folha().locator('input[inputmode=numeric]').nth(1).fill('500000');
await page.waitForTimeout(900);
console.log('4. por parcela 5.000:', (await page.textContent('#folha .cartao')).replace(/\s+/g,' ').slice(0,110));
await page.screenshot({ path: dir+'/i01-por-parcela.png', fullPage:true });
// volta para 12x na mão
await page.click('#folha .selecao >> nth=1'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("12x")'); await page.waitForTimeout(900);
console.log('5. voltou para 12x:', (await page.textContent('#folha .cartao')).replace(/\s+/g,' ').slice(0,80));
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(900);
console.log('6. confirmação:', (await page.textContent('#dialogoTexto')).replace(/\s+/g,' '));
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(1800);
const p0 = await parcelas();
console.log('7. criou', p0.length, 'parcelas | 1ª:', p0[0], '| última:', p0[p0.length-1]);
await browser.close();

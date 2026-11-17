// Extrato do Banco Inter com "Valor" e "Saldo por transação" (pedido do
// Vitor em 17/11/2026): soma só a coluna Valor; o saldo de cada linha é só
// conferência.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');

await page.clock.setFixedTime(new Date(2026, 10, 17, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t169-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
page.on('filechooser', async fc => { await fc.setFiles(amostras + '/inter-saldo-transacao.pdf'); });
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(700);
await page.click('#telaMais .linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .item-extrato', { timeout: 60000 }); await page.waitForTimeout(600);
const itens = await page.$$eval('#folha .item-extrato', ns => ns.map(n => n.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()));
console.log(itens.join('\n'));
const valores = itens.map(t => { const m = t.match(/([+−-]) ?R\$ ([\d.]+,\d\d)\s*$/); return m ? (m[1] === '+' ? '' : '-') + m[2] : '?'; });
console.log('valores:', valores.join(' '));
const esperado = ['0,40', '-20,00', '100,00', '0,60', '-30,00', '0,16', '0,11', '-50,00', '1,00', '-2,27', '47,00', '-47,00', '5,00', '2,27'];
const ordenados = (a) => a.slice().sort().join(' ');
conferir('1. os 14 lançamentos, cada um com o valor da coluna "Valor" (não o saldo)', valores.length === 14 && ordenados(valores) === ordenados(esperado), valores.join(' '));
const resumo = limpo(await folha().locator('.resumo-extrato').textContent().catch(() => ''));
conferir('2. soma só a coluna Valor e confere com o saldo de cada linha', /Entradas R\$ 156,54/.test(resumo) && /Saídas R\$ 149,27/.test(resumo) &&
  /Conferido com o saldo de cada linha do extrato: tudo bate ✓/.test(resumo) && !(await folha().locator('.fora-do-saldo').count()), resumo);
await folha().locator('.resumo-extrato').screenshot({ path: dir + '/z82-inter-saldo.png' }).catch(() => {});

// ---- um valor que não bate com o saldo da linha fica marcado ----
await page.goBack(); await page.waitForTimeout(800);
page.removeAllListeners('filechooser');
page.on('filechooser', async fc => { await fc.setFiles(amostras + '/inter-saldo-errado.pdf'); });
await page.click('#navegacao button:has-text("Mais")').catch(() => {}); await page.waitForTimeout(700);
await page.click('#telaMais .linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .item-extrato', { timeout: 60000 }); await page.waitForTimeout(600);
const resumo2 = limpo(await folha().locator('.resumo-extrato').textContent().catch(() => ''));
const marcado = limpo(await folha().locator('.item-extrato:has(.fora-do-saldo)').first().textContent().catch(() => ''));
conferir('3. o lançamento que não bate com o saldo fica marcado em vermelho', /1 lançamento\(s\) não batem com o saldo da linha/.test(resumo2) &&
  (await folha().locator('.fora-do-saldo').count()) === 1 && /112\/00336022126/.test(marcado) && /10,00/.test(marcado), resumo2 + ' | ' + marcado);
await page.screenshot({ path: dir + '/z83-inter-nao-bate.png' });

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

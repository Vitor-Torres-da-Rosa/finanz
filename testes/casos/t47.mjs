import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
import { tocarFab } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, acceptDownloads:true });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
const folha = () => page.locator('#folha');

await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' });
await page.waitForTimeout(1400);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('r'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
// conta + lançamento
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await folha().locator('input.entrada[type=text]').first().fill('Nubank');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
await tocarFab(page); await page.waitForTimeout(700);
await folha().locator('input[inputmode=numeric]').first().fill('15000');
await folha().locator('input.entrada[type=text]').first().fill('Salário teste');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1200);

// backup
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(700);
const dl = page.waitForEvent('download');
await page.click('#telaMais .linha:has-text("Fazer backup")'); await page.waitForTimeout(1200);
const d = await dl; const caminho = dir + '/bkp.json'; await d.saveAs(caminho);
console.log('1. baixou:', d.suggestedFilename());
const fs = await import('fs');
const txt = fs.readFileSync(caminho, 'utf8');
console.log('   tamanho:', txt.length, '| chaves:', Object.keys(JSON.parse(txt)));
console.log('   dados:', Object.keys(JSON.parse(txt).dados));

// restaurar
page.on('filechooser', async fc => { await fc.setFiles(caminho); });
await page.click('#telaMais .linha:has-text("Restaurar backup")'); await page.waitForTimeout(1500);
console.log('2. aviso na tela:', await page.locator('#toque').textContent().catch(()=>'-'));
console.log('   diálogo:', await page.locator('#dialogoTitulo').textContent().catch(()=>'-'), '|', await page.locator('#dialogoTexto').textContent().catch(()=>'-'));
await page.screenshot({ path: dir + '/b01-restaurar.png' });
const btns = await page.$$eval('#dialogoAcoes button', ns => ns.map(x=>x.textContent));
console.log('   botões:', btns);
if (btns.length) { await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(1500); }
console.log('3. aviso depois:', await page.locator('#toque').textContent().catch(()=>'-'));
console.log('   estado:', await page.evaluate(() => { try { return JSON.stringify({c: window.__e ? 1 : 0}); } catch(e){ return 'x'; } }));
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(800);
console.log('   tela:', (await page.textContent('#telaInicio')).replace(/\s+/g,' ').slice(0,220));
await page.screenshot({ path: dir + '/b02-depois.png' });
await browser.close();

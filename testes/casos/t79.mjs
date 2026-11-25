// O app virou Finanz: nome, ícone e manifesto. Os dados de quem já usava
// continuam onde estavam — a troca de nome não pode apagar nada.
import { chromium, dir, amostras, ENDERECO, gerarBackup } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);

console.log('1. título da aba:', await page.title());
console.log('2. marca na abertura:', await page.textContent('.marca-nome'));
const man = await page.evaluate(async () => {
  const r = await fetch('manifest.webmanifest'); const j = await r.json();
  return { nome: j.name, curto: j.short_name, icones: j.icons.map(i => i.src + ' ' + i.purpose) };
});
console.log('3. manifesto:', JSON.stringify(man));
console.log('4. favicon:', await page.$$eval('link[rel="icon"], link[rel="apple-touch-icon"]', ns=>ns.map(n=>n.getAttribute('href'))));
const icones = await page.evaluate(async () => {
  const out = {};
  for (const f of ['icon.svg','icon-192.png','icon-512.png','icon-maskable.png']) {
    const r = await fetch(f); out[f] = r.status;
  }
  return out;
});
console.log('5. ícones servidos:', JSON.stringify(icones));
await page.screenshot({ path: dir+'/m01-abertura-finanz.png' });

// cria conta e confere o nome nas telas
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('l79'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
console.log('6. topo do Início:', (await page.textContent('#telaInicio .marca-nome').catch(()=>'-')));
await page.screenshot({ path: dir+'/m02-inicio-finanz.png' });

await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1000);
const mais = (await page.textContent('#telaMais')).replace(/\s+/g,' ');
console.log('7. rodapé de Mais:', (mais.match(/Finanz vers[^ ]* [0-9.]+/)||['-'])[0]);
console.log('8. sobrou "Caixa" em Mais?', /\bCaixa\b/.test(mais));
await page.click('#telaMais .linha:has-text("Novidades")'); await page.waitForTimeout(1000);
console.log('9. novidades:', (await page.textContent('#folha')).replace(/\s+/g,' ').slice(0,170));
await page.screenshot({ path: dir+'/m03-novidades.png' });
await page.keyboard.press('Escape'); await page.waitForTimeout(700);

// os dados de quem vinha do Caixa continuam lá: as chaves não mudaram
const chaves = await page.evaluate(() => Object.keys(localStorage).filter(k => k.indexOf('caixa.') === 0));
console.log('10. chaves de dados preservadas:', chaves.sort());
// backup sai com o nome novo
const baixandoBkp = page.waitForEvent('download', { timeout: 20000 });
await gerarBackup(page);
const nomeBkp = (await baixandoBkp).suggestedFilename();
console.log('11. nome do arquivo de backup:', nomeBkp);
await browser.close();

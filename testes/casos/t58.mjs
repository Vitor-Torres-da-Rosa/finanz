import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
import fs from 'fs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
const folha = () => page.locator('#folha');
let arquivo = amostras + '/c6-fatura.pdf';
page.on('filechooser', async fc => { await fc.setFiles(arquivo); });

await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
const email = 'p'+Date.now() + '-' + process.pid + '@exemplo.com';
await c.nth(0).fill('Vitor'); await c.nth(1).fill(email); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// 1) o input está desenhado (não é display:none)?
const inp = await page.evaluate(() => {
  const e = document.getElementById('arquivoExtrato');
  const cs = getComputedStyle(e);
  return { display: cs.display, visibility: cs.visibility, w: e.offsetWidth, h: e.offsetHeight };
});
console.log('1. input:', JSON.stringify(inp));

// 2) a linha do menu é um <label> ligado ao input?
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
const rot = await page.evaluate(() => {
  const l = [...document.querySelectorAll('#telaMais label.linha')].map(x => ({ tag: x.tagName, para: x.getAttribute('for'), txt: x.textContent.replace(/\s+/g,' ').slice(0,40) }));
  return l;
});
console.log('2. rótulos:', JSON.stringify(rot));

// 3) tocar no rótulo abre o seletor e importa
await page.click('#telaMais label.linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .cabeca-banco', { timeout: 60000 }); await page.waitForTimeout(600);
console.log('3. abriu pelo rótulo:', await page.textContent('#folhaTitulo'), '| banco:',
  (await page.textContent('#folha .cabeca-nome')));
await page.goBack(); await page.waitForTimeout(800);

// 4) service worker ativo?
const sw = await page.evaluate(async () => {
  const r = await navigator.serviceWorker.getRegistration();
  return r ? (r.active ? 'ativo' : 'registrado') : 'nenhum';
});
console.log('4. service worker:', sw);

// 5) COMPARTILHAR: manda o arquivo por POST como o Android faz
const b64 = fs.readFileSync(amostras+'/c6-fatura.pdf').toString('base64');
const resp = await page.evaluate(async (b64) => {
  const bin = atob(b64); const by = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) by[i]=bin.charCodeAt(i);
  const fd = new FormData();
  fd.append('arquivo', new File([by], 'fatura_c6_agosto.pdf', { type: 'application/pdf' }));
  const r = await fetch('./compartilhar', { method: 'POST', body: fd, redirect: 'manual' });
  return { status: r.status, type: r.type, url: r.url };
}, b64);
console.log('5. POST compartilhar:', JSON.stringify(resp));
const guardado = await page.evaluate(async () => {
  const cache = await caches.open('caixa-partilha');
  const r = await cache.match('./arquivo-compartilhado');
  return r ? { nome: decodeURIComponent(r.headers.get('X-Nome')||''), tipo: r.headers.get('Content-Type'), tam: (await r.blob()).size } : null;
});
console.log('   guardado no cache:', JSON.stringify(guardado));

// 6) abrir o app com a marca -> tem que importar sozinho
await page.goto('http://127.0.0.1:8833/index.html?compartilhado=1', { waitUntil:'networkidle' });
await page.waitForSelector('#folha .cabeca-banco', { timeout: 60000 });
await page.waitForTimeout(800);
console.log('6. veio pelo compartilhar:', await page.textContent('#folhaTitulo'),
  '| banco:', await page.textContent('#folha .cabeca-nome'),
  '|', (await page.textContent('#folha .resumo-extrato')).replace(/\s+/g,' ').slice(0,60));
console.log('   URL limpa:', page.url());
await page.screenshot({ path: dir+'/g01-compartilhado.png' });
await browser.close();

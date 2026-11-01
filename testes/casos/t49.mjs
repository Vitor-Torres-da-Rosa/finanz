import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
import { tocarFab } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, acceptDownloads:true });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
const folha = () => page.locator('#folha');
const lanc = async (desc, val) => {
  await tocarFab(page); await page.waitForTimeout(700);
  await folha().locator('input[inputmode=numeric]').first().fill(val);
  await folha().locator('input.entrada[type=text]').first().fill(desc);
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1100);
};
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1400);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('s'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await folha().locator('input.entrada[type=text]').first().fill('Nubank');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
await lanc('Antigo A', '10000');

// backup neste ponto
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(700);
const dl = page.waitForEvent('download');
await page.click('#telaMais .linha:has-text("Fazer backup")'); await page.waitForTimeout(1000);
const caminho = dir+'/bkp2.json'; await (await dl).saveAs(caminho);
console.log('1. backup feito com: Antigo A');

// agora adiciona algo novo e sincroniza para o servidor
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(600);
await lanc('Depois B', '77700');
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(600);
await page.click('#telaMais .linha:has-text("Sincronizar agora")'); await page.waitForTimeout(4000);
console.log('2. servidor agora tem A e B');

// restaura o backup antigo (só tem A)
page.on('filechooser', async fc => { await fc.setFiles(caminho); });
await page.click('#telaMais .linha:has-text("Restaurar backup")'); await page.waitForTimeout(1500);
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(2000);
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(900);
console.log('3. logo após restaurar:', (await page.textContent('#telaTransacoes')).replace(/\s+/g,' ').match(/Antigo A|Depois B/g));

// força a sincronia
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(600);
await page.click('#telaMais .linha:has-text("Sincronizar agora")'); await page.waitForTimeout(5000);
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(900);
console.log('4. depois de sincronizar:', (await page.textContent('#telaTransacoes')).replace(/\s+/g,' ').match(/Antigo A|Depois B/g));
await page.screenshot({ path: dir+'/b03-sync.png' });
await browser.close();

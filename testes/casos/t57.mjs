import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
const folha = () => page.locator('#folha');
let arquivo = null;
page.on('filechooser', async fc => { await fc.setFiles(arquivo); });
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1400);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('k'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// conta normal: os campos de cartão têm que estar escondidos
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(800);
const visiveis = await page.$$eval('#folha .campo', ns => ns.filter(n=>n.offsetParent!==null).map(n=>{const l=n.querySelector('label');return l?l.textContent:'?';}));
console.log('1. conta normal — campos visíveis:', visiveis);
await folha().locator('input.entrada[type=text]').first().fill('Nubank');
await folha().locator('input[inputmode=numeric]').first().fill('200000');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1200);

// cartão
await page.click('#telaInicio .cartao:has-text("Cartões") .cartao-acao'); await page.waitForTimeout(800);
const vis2 = await page.$$eval('#folha .campo', ns => ns.filter(n=>n.offsetParent!==null).map(n=>{const l=n.querySelector('label');return l?l.textContent:'?';}));
console.log('2. cartão — campos visíveis:', vis2);
await page.click('#folha .selecao >> nth=0'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("C6 Bank")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);

arquivo = amostras + '/c6-fatura.pdf';
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
await page.click('#telaMais .linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .cabeca-banco', { timeout: 60000 }); await page.waitForTimeout(600);
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Sim")'); await page.waitForTimeout(2500);

await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1500);
const nums = await page.evaluate(() => {
  const pega = t => { const s=[...document.querySelectorAll('#telaInicio .cartao')].find(c=>c.textContent.includes(t)); return s?s.textContent.replace(/\s+/g,' '):'-'; };
  return { patrimonio: (document.querySelector('#telaInicio .valorao')||{}).textContent,
           contas: pega('Total em contas').match(/Total em contas ([^A-Z]*)/)?.[1],
           cartoes: pega('Total a pagar nos cartões').match(/Total a pagar nos cartões ([^A-Z]*)/)?.[1] };
});
console.log('3. patrimônio:', nums.patrimonio, '| em contas:', nums.contas, '| dívida cartões:', nums.cartoes);
console.log('   esperado: contas 2.000,00 | dívida 1.140,09 - 1.200,00 = -59,91 | patrimônio 2.059,91');
await page.screenshot({ path: dir+'/f10-inicio.png', fullPage:true });
// remover o cartão
await page.click('#telaInicio .cartao:has-text("Cartões") .linha-acao'); await page.waitForTimeout(900);
console.log('4. editar:', await page.textContent('#folhaTitulo'));
const btns = await page.$$eval('#folha .acoes button', ns=>ns.map(x=>x.textContent));
console.log('   botões:', btns);
await page.click('#folha .btn-perigo'); await page.waitForTimeout(900);
console.log('5. confirmação:', await page.textContent('#dialogoTitulo').catch(()=>'-'), '|', (await page.textContent('#dialogoTexto').catch(()=>'-')).slice(0,90));
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(1800);
console.log('6. cartões depois:', (await page.textContent('#telaInicio .cartao:has-text("Cartões")')).replace(/\s+/g,' ').slice(0,80));
await browser.close();

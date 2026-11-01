import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
import { tocarFab } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
const folha = () => page.locator('#folha');

await page.goto(ENDERECO, { waitUntil: 'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1400);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('z' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(500);
await tocarFab(page); await page.waitForTimeout(700);
console.log('1. botões da folha:', await page.$$eval('#folha button', ns => ns.map(b=>b.textContent.trim()).filter(t=>t)));
console.log('   dica:', await page.textContent('#folha .telefone-marca'));

await folha().locator('input.entrada[type=text]').nth(0).fill('Edison');
const tels = () => folha().locator('input[type=tel]');
await tels().nth(0).click(); await tels().nth(0).type('51997308860');   // celular
await page.click('#folha button:has-text("+ Outro número")'); await page.waitForTimeout(400);
await tels().nth(1).click(); await tels().nth(1).type('5133445566');    // fixo
await page.waitForTimeout(400);
console.log('2. verdes:', await page.locator('#folha .linha-acao.tem-whats').count(), '| resumo:', (await page.textContent('#folha .telefone-marca')).replace(/\s+/g,' '));
await page.screenshot({ path: dir + '/y01-cliente.png' });

// toca no ícone do fixo
const icones = () => folha().locator('.telefone-linha .linha-acao').first();
await page.click('#folha .telefone-linha:nth-of-type(2) .linha-acao'); await page.waitForTimeout(700);
console.log('3. menu do fixo:', await page.textContent('#escolhaTitulo'));
console.log('   opções:', await page.$$eval('#escolhaLista .escolha-item .txt', ns => ns.map(x=>x.textContent.replace(/\s+/g,' '))));
console.log('   selecionado:', await page.$$eval('#escolhaLista .escolha-item[aria-selected=true] .txt', ns => ns.map(x=>x.textContent.replace(/\s+/g,' '))));
console.log('   rodapé:', await page.$$eval('#escolhaRodape button', ns => ns.map(x=>x.textContent)));
await page.screenshot({ path: dir + '/y02-menu.png' });
// marca o fixo como tendo WhatsApp
await page.click('#escolhaLista .escolha-item:has-text("Tem WhatsApp")'); await page.waitForTimeout(800);
console.log('4. verdes depois:', await page.locator('#folha .linha-acao.tem-whats').count(), '| resumo:', (await page.textContent('#folha .telefone-marca')).replace(/\s+/g,' '));

// e a escolha manual sobrevive a digitar mais
await tels().nth(1).click(); await tels().nth(1).press('Backspace'); await tels().nth(1).type('6');
await page.waitForTimeout(400);
console.log('5. depois de digitar, verdes:', await page.locator('#folha .linha-acao.tem-whats').count());

// testa o "abrir a conversa"
await page.click('#folha .telefone-linha:nth-of-type(1) .linha-acao'); await page.waitForTimeout(700);
await page.evaluate(() => { window.__aberto = null; window.open = (u) => { window.__aberto = u; return null; }; });
await page.click('#escolhaRodape button >> nth=0');
await page.waitForTimeout(1200);
console.log('6. link de teste:', await page.evaluate(() => window.__aberto));
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1000);
console.log('7. salvo na lista:', (await page.textContent('#telaInicio .linha-sub')).trim());
console.log('   ícone de whats na lista:', await page.locator('#telaInicio .linha-acao').count());
await browser.close();

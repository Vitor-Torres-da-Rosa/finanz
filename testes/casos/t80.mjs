// Endereço do cliente com botão de rota, e orçamento do começo ao PDF.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
import fs from 'fs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, acceptDownloads:true });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('l80'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// quem assina o orçamento
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Preferências")'); await page.waitForTimeout(900);
let ent = page.locator('#folha input.entrada');
await ent.nth(1).fill('Vitor Torres Elétrica');
await ent.nth(2).fill('(51) 99999-0000');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1200);
console.log('1. emitente salvo');

// cliente com endereço
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
await page.click('#telaInicio button:has-text("Empreendedor")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .fab, #telaInicio button:has-text("Cadastrar primeiro cliente")'); await page.waitForTimeout(1000);
const campos = page.locator('#folha input.entrada');
await campos.nth(0).fill('Gustavo Appelt');
await page.locator('#folha input[type=tel]').first().fill('47984210000');
const todos = await page.$$eval('#folha .campo', ns => ns.map(n => n.textContent.replace(/\s+/g,' ').slice(0,30)));
console.log('2. campos do cliente:', todos);
const cEnd = page.locator('#folha .campo:has-text("Endereço") input');
await cEnd.fill('Rua das Palmeiras, 240 - Centro, Blumenau/SC');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
console.log('3. cliente salvo com endereço');
console.log('4. botão de rota na lista?', await page.locator('#telaInicio .linha-acao[aria-label^="Rota"]').count());
await page.screenshot({ path: dir+'/n01-lista-rota.png' });

// para onde o botão de rota manda
// Esperar o botão existir: o sono de 1800ms depois de salvar não cobre a
// suíte inteira em paralelo, e o querySelector voltava nulo.
await page.waitForSelector('#telaInicio .linha-acao[aria-label^="Rota"]', { timeout: 60000 });
const destino = await page.evaluate(() => {
  let ida = null;
  const d = Object.getOwnPropertyDescriptor(window.location, 'href');
  // não dá para interceptar location.href; olho o fallback do Google Maps
  const abrir = window.open;
  window.open = (u) => { ida = u; return null; };
  document.querySelector('#telaInicio .linha-acao[aria-label^="Rota"]').click();
  return new Promise(r => setTimeout(() => { window.open = abrir; r(ida); }, 1800));
});
console.log('5. rota cai em:', destino);

// orçamento
await page.click('#telaInicio .linha-alvo:has-text("Gustavo Appelt")'); await page.waitForTimeout(1400);
console.log('6. abas da ficha:', await page.$$eval('#folha .aba-cliente button', ns=>ns.map(n=>n.textContent)));
await page.click('#folha .aba-cliente button:has-text("Orçamentos")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Simular serviço")'); await page.waitForTimeout(1000);
console.log('7. folha:', await page.textContent('#folhaTitulo'));
await page.locator('#folha .campo:has-text("Descrição") input').fill('Troca do padrão de entrada');
// materiais
const cMateriais = page.locator('#folha .cartao:has-text("Materiais")').first();
await cMateriais.locator('.cartao-topo button').click(); await page.waitForTimeout(600);
let mat = cMateriais.locator('.linha-item-orc');
await mat.nth(0).locator('input').nth(0).fill('Disjuntor 63A');
await mat.nth(0).locator('input').nth(1).fill('18990');
await cMateriais.locator('.cartao-topo button').click(); await page.waitForTimeout(600);
mat = cMateriais.locator('.linha-item-orc');
await mat.nth(1).locator('input').nth(0).fill('Cabo 16mm (10 m)');
await mat.nth(1).locator('input').nth(1).fill('24000');
await page.locator('#folha .campo:has-text("Mão de obra") input').fill('90000');
await page.locator('#folha .campo:has-text("Custo logístico") input').fill('12000');
await page.locator('#folha .campo').filter({ hasText: /^Desconto$/ }).locator('input').fill('5000');
await page.waitForTimeout(500);
console.log('8. preços:', (await page.textContent('#folha .cartao:has-text("Como fica para o cliente")')).replace(/\s+/g,' ').slice(0,200));
await page.screenshot({ path: dir+'/n02-orcamento.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar orçamento")'); await page.waitForTimeout(1600);
console.log('9. orçamento pronto:', await page.textContent('#folhaTitulo'));
console.log('   conta:', await page.$$eval('#folha .conf-linha', ns=>ns.map(n=>n.textContent.replace(/\s+/g,' '))));
await page.screenshot({ path: dir+'/n03-pronto.png', fullPage: true });

// baixa o PDF
const [dl] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#folha .btn-fantasma:has-text("Salvar o PDF no celular")')
]);
const destinoPdf = dir + '/n-orcamento.pdf';
await dl.saveAs(destinoPdf);
console.log('10. PDF baixado:', dl.suggestedFilename(), fs.statSync(destinoPdf).size, 'bytes');
await browser.close();

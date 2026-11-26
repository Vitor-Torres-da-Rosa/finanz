// Conferir a conta: saldo do app x saldo do banco, mês a mês, repetidos e
// desfazer a importação inteira.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('filechooser', async fc => { await fc.setFiles(amostras+'/inter-quebrado.pdf'); });
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('l76'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
await page.click('#telaMais label.linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .cabeca-banco', { timeout: 60000 }); await page.waitForTimeout(1200);
const linhas = await page.$$eval('#folha .item-extrato', ns=>ns.map(n=>n.textContent.replace(/\s+/g,' ').trim()));
console.log('1. lido do extrato (valor, não saldo):');
linhas.forEach(l=>console.log('   ', l.slice(0,80)));
await page.click('#folha .selecao'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Criar conta")'); await page.waitForTimeout(1500);
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Sim")'); await page.waitForTimeout(2500);
console.log('2. aviso do saldo:', await page.textContent('#dialogoTitulo').catch(()=>'(nenhum)'));
console.log('   texto:', (await page.textContent('#dialogoTexto').catch(()=>'-')).replace(/\s+/g,' ').slice(0,150));
await page.screenshot({ path: dir+'/i01-aviso-saldo.png' });
await page.click('#dialogoAcoes button'); await page.waitForTimeout(1500);

// abre a conta e confere
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .linha:has-text("Banco Inter")'); await page.waitForTimeout(1200);
console.log('3. saldo da conta:', await page.textContent('#folha .valorao'));
await page.evaluate(() => { const b = document.querySelector('#folha .botao-saldo-correto'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }); await page.waitForTimeout(400);
await page.click('#folha .btn-ouro:has-text("Conferir esta conta")'); await page.waitForTimeout(1400);
console.log('4. folha:', await page.textContent('#folhaTitulo'));
console.log('5. números:', await page.$$eval('#folha .conf-item', ns=>ns.map(n=>n.textContent.replace(/\s+/g,' '))));
console.log('6. mês a mês:', await page.$$eval('#folha .conf-linha', ns=>ns.map(n=>n.textContent.replace(/\s+/g,' '))));
console.log('7. diferença:', await page.textContent('#folha .linha-nota.verde, #folha .linha-nota.vermelho').catch(()=>'-'));
await page.screenshot({ path: dir+'/i02-conferir.png', fullPage: true });

// diz que o banco mostra outro saldo e acerta
const campo = page.locator('#folha input.entrada').first();
await campo.fill('50000'); await page.waitForTimeout(400);
console.log('8. com R$ 500,00 no banco:', await page.textContent('#folha .linha-nota.vermelho'));
await page.click('#folha .btn-fantasma:has-text("Acertar o saldo inicial")'); await page.waitForTimeout(700);
console.log('9. pergunta:', await page.textContent('#dialogoTitulo'));
await page.click('#dialogoAcoes button:has-text("Acertar")'); await page.waitForTimeout(1800);
console.log('10. depois de acertar:', await page.textContent('#folha .valorao'));

// desfazer a importação
await page.evaluate(() => { document.getElementById('folha').scrollTop = 99999; });
await page.waitForTimeout(400);
console.log('11. importações:', await page.$$eval('#folha .linha .linha-titulo', ns=>ns.map(n=>n.textContent).slice(-3)));
await page.screenshot({ path: dir+'/i03-importacoes.png' });
await page.click('#folha .btn-mini:has-text("Tirar")'); await page.waitForTimeout(800);
console.log('12. pergunta:', await page.textContent('#dialogoTitulo'));
await page.click('#dialogoAcoes button:has-text("Tirar tudo")'); await page.waitForTimeout(2000);
console.log('13. depois de tirar:', await page.$$eval('#folha .conf-item', ns=>ns.map(n=>n.textContent.replace(/\s+/g,' ')).slice(0,1)));
console.log('14. sumiu o botão de apagar tudo?', (await page.locator('#folha .btn-vermelho').count()) === 0);
await page.screenshot({ path: dir+'/i04-vazio.png' });
await browser.close();

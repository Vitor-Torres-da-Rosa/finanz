import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('h'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// 1) a seção Cartões existe e está vazia
console.log('1. seções:', await page.$$eval('#telaInicio .cartao .topo-cartao > div, #telaInicio .topo-cartao b, #telaInicio h2', ns=>ns.map(x=>x.textContent).filter(t=>/Contas|Cart/.test(t))));
const vazio = await page.textContent('#telaInicio .cartao:has-text("Cartões")').catch(()=>'-');
console.log('   vazio:', vazio.replace(/\s+/g,' ').slice(0,110));
await page.screenshot({ path: dir+'/f01-inicio-vazio.png', fullPage:true });

// 2) adicionar cartão pelo + Novo
await page.click('#telaInicio .cartao:has-text("Cartões") .cartao-acao'); await page.waitForTimeout(800);
console.log('2. folha:', await page.textContent('#folhaTitulo'));
const rotulos = await page.$$eval('#folha .campo > label', ns=>ns.map(x=>x.textContent));
console.log('   campos:', rotulos);
// escolhe o banco
await page.click('#folha .selecao >> nth=0'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("C6 Bank")'); await page.waitForTimeout(800);
console.log('3. nome preenchido:', await folha().locator('input.entrada[type=text]').first().inputValue());
const diaDe = (rotulo) => page.locator(`#folha .campo:has-text("${rotulo}") .selecao`).first();
await diaDe('Melhor dia de compra').click(); await page.waitForTimeout(700);
await page.locator('#escolhaLista').getByText('Dia 26', { exact: true }).click(); await page.waitForTimeout(700);
await diaDe('Vence no dia').click(); await page.waitForTimeout(700);
await page.locator('#escolhaLista').getByText('Dia 5', { exact: true }).click(); await page.waitForTimeout(700);
console.log('4. melhor dia/vence:', await diaDe('Melhor dia de compra').textContent(), '/', await diaDe('Vence no dia').textContent());
console.log('   fechamento derivado:', (await page.textContent('#folha .melhor-dia')).replace(/\s+/g,' ').trim());
console.log('   melhor dia:', (await page.textContent('#folha .linha-nota.ouro').catch(()=>'-')).replace(/\s+/g,' '));
await page.screenshot({ path: dir+'/f02-novo-cartao.png', fullPage:true });
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);

// 3) o cartão aparece na seção com o selo do banco
const cart = await page.evaluate(() => {
  const sec = [...document.querySelectorAll('#telaInicio .cartao')].find(c=>/Cartões/.test(c.textContent));
  const l = sec && sec.querySelector('.linha-alvo');
  const s = l && l.querySelector('.selo');
  return l ? { txt: l.textContent.replace(/\s+/g,' '), marca: s&&s.textContent,
               fundo: s&&getComputedStyle(s).backgroundColor, cor: s&&getComputedStyle(s).color } : null;
});
console.log('5. cartão na lista:', JSON.stringify(cart));
console.log('   contas ainda tem cartão?', await page.evaluate(() => {
  const sec = [...document.querySelectorAll('#telaInicio .cartao')].find(c=>/^\s*Contas/.test(c.textContent));
  return sec ? /C6/.test(sec.textContent) : 'sem seção';
}));
await page.screenshot({ path: dir+'/f03-cartao-criado.png', fullPage:true });

// 4) importar a fatura para esse cartão
arquivo = amostras + '/c6-fatura.pdf';
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
await page.click('#telaMais .linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .cabeca-banco', { timeout: 30000 }); await page.waitForTimeout(600);
console.log('6. conta sugerida:', await page.textContent('#folha .selecao'));
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Sim")'); await page.waitForTimeout(2500);

// 5) tela do cartão
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .cartao:has-text("Cartões") .linha-alvo'); await page.waitForTimeout(1200);
console.log('7. tela do cartão:', await page.textContent('#folhaTitulo'));
console.log('   fatura aberta:', (await page.textContent('#folha .cartao')).replace(/\s+/g,' ').slice(0,170));
console.log('   faturas:', await page.$$eval('#folha .cartao:has-text("Faturas") .linha-alvo', ns=>ns.map(x=>x.textContent.replace(/\s+/g,' '))));
console.log('   últimos gastos:', await page.locator('#folha .cartao:has-text("Últimos gastos") .linha-alvo').count());
await page.screenshot({ path: dir+'/f04-tela-cartao.png', fullPage:true });
// abre uma fatura
await page.click('#folha .cartao:has-text("Faturas") .linha-alvo >> nth=0'); await page.waitForTimeout(1200);
console.log('8. fatura do mês:', await page.textContent('#folhaTitulo'));
console.log('   ', (await page.textContent('#folha .cartao')).replace(/\s+/g,' ').slice(0,140));
console.log('   itens:', await page.locator('#folha .linha-alvo').count());
await page.screenshot({ path: dir+'/f05-fatura-mes.png', fullPage:true });
await browser.close();

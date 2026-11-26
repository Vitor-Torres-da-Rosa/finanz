// Conferência com muitos meses e muitos repetidos: dá para ver todos os
// meses de página em página, e cada grupo repetido abre uma a uma.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('l78'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// 80 meses de movimento + 34 grupos repetidos, como no aparelho do Vitor
await page.evaluate(() => new Promise(res => {
  const l = []; let n = 0;
  for (let m = 0; m < 80; m++) {
    const d = new Date(2019, 6 + m, 15);
    const data = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-15';
    l.push({ id:'a-t78'+(n++), tipo:'entrada', valor: 100000+m, data, contaId:'inter-t78', categoria:'Venda', descricao:'Salário '+m });
    l.push({ id:'b'+(n++), tipo:'saida', valor: 90000+m, data, contaId:'inter-t78', categoria:'Mercado', descricao:'Compra '+m });
    if (m < 34) { // o mesmo extrato importado duas vezes
      l.push({ id:'r'+(n++), tipo:'saida', valor: 2500, data, contaId:'inter-t78', categoria:'Casa',
               descricao:'Recarga - Mega+', importacaoId:'imp1', criadoEm: 1700000000000 });
      l.push({ id:'r'+(n++), tipo:'saida', valor: 2500, data, contaId:'inter-t78', categoria:'Casa',
               descricao:'Recarga - Mega+', importacaoId:'imp2', criadoEm: 1700000600000 });
    }
  }
  const dados = { contas:[{id:'inter-t78',nome:'Banco Inter',tipo:'Conta corrente',saldoInicial:0}], lancamentos:l,
    importacoes:[{id:'imp1',contaId:'inter-t78',arquivo:'extrato-agosto.pdf',banco:'Banco Inter',quando:1700000000000,quantos:34},
                 {id:'imp2',contaId:'inter-t78',arquivo:'extrato-agosto (1).pdf',banco:'Banco Inter',quando:1700000600000,quantos:34}] };
  const f = new File([JSON.stringify({app:'caixa', dados})], 'b.json', {type:'application/json'});
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1500);
await page.click('#telaInicio .linha:has-text("Banco Inter")'); await page.waitForTimeout(1400);
await page.evaluate(() => { const b = document.querySelector('#folha .botao-saldo-correto'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }); await page.waitForTimeout(400);
await page.click('#folha .btn-ouro:has-text("Conferir esta conta")'); await page.waitForTimeout(1600);

const barras = await page.$$eval('#folha .paginas-conta', ns=>ns.map(n=>n.textContent));
console.log('1. barras de página:', barras);
console.log('2. meses na 1ª página:', await page.$$eval('#folha .tabela-conf .conf-linha:not(.conf-cab)', ns=>ns.length));
console.log('   primeiro/último:', await page.$$eval('#folha .tabela-conf .conf-linha:not(.conf-cab) span:first-child', ns=>[ns[0].textContent, ns[ns.length-1].textContent]));
await page.screenshot({ path: dir+'/k01-meses.png' });

// vai para a última página de meses
const prox = page.locator('#folha .paginas').first().locator('.btn-mini:has-text("Próximos")');
let voltas = 0;
while (await prox.isEnabled() && voltas < 20) { await prox.click(); await page.waitForTimeout(220); voltas++; }
console.log('   cliques até o fim:', voltas);
console.log('3. última página de meses:', await page.locator('#folha .paginas-conta').first().textContent());
console.log('   meses mostrados:', await page.$$eval('#folha .tabela-conf .conf-linha:not(.conf-cab) span:first-child', ns=>[ns[0].textContent, ns[ns.length-1].textContent]));
console.log('4. o mês mais antigo apareceu?', (await page.textContent('#folha .tabela-conf')).includes('jul/19'));
await page.screenshot({ path: dir+'/k02-meses-fim.png' });

// grupos repetidos
const grupos = page.locator('#folha .linha:has-text("Recarga - Mega+")');
console.log('5. grupos na página:', await grupos.count());
console.log('6. rótulo antes de abrir:', await grupos.first().textContent());
await grupos.first().click(); await page.waitForTimeout(500);
console.log('7. abriu:', await page.locator('#folha .grupo-aberto').count(), 'grupo(s)');
console.log('   dentro:', await page.$$eval('#folha .grupo-aberto .linha', ns=>ns.map(n=>n.textContent.replace(/\s+/g,' '))));
await page.screenshot({ path: dir+'/k03-grupo-aberto.png' });
// abre um lançamento de dentro
await page.locator('#folha .grupo-aberto .linha').nth(1).click(); await page.waitForTimeout(1200);
console.log('8. abriu a segunda:', await page.textContent('#folhaTitulo'));
await page.screenshot({ path: dir+'/k04-lancamento.png' });

await browser.close();

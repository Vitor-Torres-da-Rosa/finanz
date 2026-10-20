import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
const folha = () => page.locator('#folha');
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1400);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
const email = 'g'+Date.now() + '-' + process.pid + '@exemplo.com';
await c.nth(0).fill('Vitor'); await c.nth(1).fill(email); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
let arquivo;
page.on('filechooser', async fc => { await fc.setFiles(arquivo); });
async function fechar() {
  if (await page.locator('#folha.aberta').count()) { await page.goBack(); await page.waitForTimeout(700); }
}
async function importar(a) {
  arquivo = a;
  await fechar();
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
  await page.click('#telaMais .linha:has-text("Importar extrato")');
  await page.waitForSelector('#folha .cabeca-banco', { timeout: 60000 });
  await page.waitForTimeout(600);
}
async function relato(n) {
  console.log(n);
  console.log('   ', (await page.textContent('#folha .cabeca-banco')).replace(/\s+/g,' '));
  console.log('    conta:', await page.textContent('#folha .selecao'));
  console.log('   ', (await page.textContent('#folha .resumo-extrato')).replace(/\s+/g,' '));
  const itens = await page.$$eval('#folha .item-extrato', ns=>ns.slice(0,3).map(x=>x.textContent.replace(/\s+/g,' ')));
  itens.forEach(i => console.log('     *', i));
}
async function lancar() {
  await page.click('#folha .selecao'); await page.waitForTimeout(700);
  const criar = await page.locator('#escolhaLista .escolha-item:has-text("Criar conta")').count();
  if (criar) { await page.click('#escolhaLista .escolha-item:has-text("Criar conta")'); }
  else { await page.click('#escolhaLista .escolha-item >> nth=0'); }
  await page.waitForTimeout(1500);
  await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
  await page.click('#dialogoAcoes button:has-text("Sim")'); await page.waitForTimeout(2500);
}

await importar(amostras+'/fatura_c6_agosto.xlsx'); await relato('1. FATURA XLSX'); await lancar();
await importar(amostras+'/fatura_c6_agosto.csv'); await relato('2. FATURA CSV (mesma conta, repetidos)');
console.log('    marcados:', await page.locator('#folha .caixinha.marcada').count(), '| já existe:', await page.locator('#folha .ja-tem').count());
await importar(amostras+'/NU_extrato_julho.xlsx'); await relato('3. EXTRATO XLSX Nubank'); await lancar();
// trocar o banco na mão
await importar(amostras+'/c6-aberto.pdf');
await page.click('#folha .cabeca-banco .btn-mini'); await page.waitForTimeout(800);
console.log('4. escolher banco:', await page.textContent('#escolhaTitulo'), '| opções:', await page.locator('#escolhaLista .escolha-item').count());
await page.click('#escolhaLista .escolha-item:has-text("Itaú")'); await page.waitForTimeout(1200);
console.log('   virou:', (await page.textContent('#folha .cabeca-banco')).replace(/\s+/g,' ').slice(0,60));
await page.screenshot({ path: dir+'/e05-trocar.png' });
// contas criadas
await fechar();
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
console.log('5. contas:', await page.$$eval('#telaInicio .linha-alvo', ns=>ns.map(n=>{
  const s=n.querySelector('.selo'), t=n.querySelector('.linha-titulo');
  return (t?t.textContent:'?') + ' [' + (s?s.textContent:'') + ' ' + (s?getComputedStyle(s).color:'') + ']';
})));
// sincroniza e confere o banco no servidor
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(700);
await page.click('#telaMais .linha:has-text("Sincronizar agora")'); await page.waitForTimeout(5000);
console.log('6. sincronizou');
await browser.close();
import pg from 'pg';
const cli = new pg.Client({ host:'/tmp', port:55433, user:'postgres', database:'caixa_app' });
await cli.connect();
const r = await cli.query("select nome, tipo, cor, banco from contas where banco <> '' order by criado_em desc limit 5");
console.log('   contas no servidor:', r.rows);
await cli.end();

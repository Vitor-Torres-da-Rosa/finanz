import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
import { tocarFab } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
const folha = () => page.locator('#folha');
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('r69'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await folha().locator('input.entrada[type=text]').first().fill('Carteira');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);

async function lancar(tipo, valor, desc, categoria) {
  await tocarFab(page); await page.waitForTimeout(700);
  if (tipo === 'entrada') { await page.click('#folha .segmentos button:has-text("Entrada")'); await page.waitForTimeout(500); }
  await folha().locator('input[inputmode=numeric]').first().fill(valor);
  await folha().locator('input.entrada[type=text]').first().fill(desc);
  const sel = folha().locator('.selecao');
  const n = await sel.count();
  for (let i=0;i<n;i++) {
    const t = await sel.nth(i).textContent();
    if (/Salário|Serviços|Moradia|Transporte|Alimenta/.test(t)) {
      await sel.nth(i).click(); await page.waitForTimeout(600);
      await page.click(`#escolhaLista .escolha-item:has-text("${categoria}")`); await page.waitForTimeout(600);
      break;
    }
  }
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1100);
}
await lancar('saida', '15000', 'Mercado do mês', 'Mercado');
await lancar('saida', '8000', 'Gasolina', 'Combustível');
await lancar('entrada', '300000', 'Salário do mês', 'Salário');
await lancar('entrada', '50000', 'Freela de site', 'Freela');

const cartao = async () => (await page.textContent('#telaInicio .cartao:has-text("Distribuição")')).replace(/\s+/g,' ');
console.log('1. padrão:', (await cartao()).slice(0, 150));
await page.screenshot({ path: dir+'/o01-despesas.png', fullPage:true });
await page.click('#telaInicio .cartao:has-text("Distribuição") .segmentos button:has-text("Receitas")'); await page.waitForTimeout(1000);
console.log('2. receitas:', (await cartao()).slice(0, 150));
await page.screenshot({ path: dir+'/o02-receitas.png', fullPage:true });
await page.click('#telaInicio .cartao:has-text("Distribuição") .segmentos button:has-text("Despesas")'); await page.waitForTimeout(1000);
console.log('3. voltou:', (await cartao()).slice(0, 90));
// relatório traz os dois lados
await page.click('#telaInicio .cartao:has-text("Distribuição") .cartao-acao'); await page.waitForTimeout(1500);
const rel = (await page.textContent('#relConteudo')).replace(/\s+/g,' ');
console.log('4. relatório tem "Receitas por categoria"?', /Receitas por categoria/.test(rel));
console.log('   tem "Despesas por categoria"?', /Despesas por categoria/.test(rel));
console.log('   trecho:', rel.slice(rel.indexOf('Receitas por categoria'), rel.indexOf('Receitas por categoria')+150));
await page.screenshot({ path: dir+'/o03-relatorio.png', fullPage:true });
await browser.close();

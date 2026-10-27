// Saldo negativo na conferência, e importar lote pelo botão da conferência.
//
// Dois bugs de 5.25.1: (1) o campo "Saldo que o banco mostra" não aceitava
// valor negativo; (2) importar vários extratos pelo botão "Importar extrato
// desta conta" travava no último arquivo — a folha ficava aberta por cima.
import { chromium, dir, ENDERECO } from '../comum.mjs';
import fs from 'node:fs';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const semDialogo = async () => {
  if (!(await page.locator('#dialogoFundo.aberta').count())) return '';
  const t = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
  const bs = page.locator('#dialogoAcoes button');
  await bs.nth((await bs.count()) - 1).click();
  await page.waitForTimeout(900);
  return t;
};

const arq1 = dir + '/t136-ext1-' + process.pid + '.csv';
const arq2 = dir + '/t136-ext2-' + process.pid + '.csv';
fs.writeFileSync(arq1,
  'Data;Descrição;Valor\r\n' +
  '10/07/2026;PIX RECEBIDO MARIA;800,00\r\n', 'utf8');
fs.writeFileSync(arq2,
  'Data;Descrição;Valor\r\n' +
  '15/08/2026;PAGAMENTO BOLETO;-1200,00\r\n', 'utf8');

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t136-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Criar conta
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(600);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1200);

// Abrir conferência
await page.click('#telaInicio .cartao:has-text("Contas") .linha:has-text("Inter")');
await page.waitForTimeout(1500);
await page.click('#folha .btn-ouro:has-text("Conferir esta conta")'); await page.waitForTimeout(3500);

// ---- 1. Saldo negativo ----
const campoSaldo = page.locator('#folha input.entrada').first();
await campoSaldo.fill('');
// Digitar "-481874" que deve virar "-R$ 4.818,74"
await campoSaldo.type('-481874');
await page.waitForTimeout(300);
const valorCampo = await campoSaldo.inputValue();
console.log('campo:', valorCampo);
conferir('1. o campo aceita saldo negativo', /[-−]/.test(valorCampo) && /4[.]?818/.test(valorCampo), valorCampo);

// ---- 2. Importar lote de 2 arquivos pelo botão da conferência ----
page.on('filechooser', async (fc) => { await fc.setFiles([arq1, arq2]); });

await page.click('#folha button:has-text("Importar extrato desta conta")');
await page.waitForTimeout(5000);

// Arquivo 1 de 2
const titulo1 = limpo(await page.textContent('#folhaTitulo').catch(() => ''));
conferir('2. o primeiro arquivo abriu a conferência', /Conferir o extrato/.test(titulo1), titulo1);
const lote1 = limpo(await page.locator('#folha .linha-nota').first().textContent().catch(() => ''));
conferir('3. mostra "Arquivo 1 de 2"', /1 de 2/.test(lote1), lote1);

// Importar o primeiro
await page.click('#folha .btn-ouro:has-text("Importar")'); await page.waitForTimeout(1500);
if (await page.locator('#dialogoFundo.aberta').count()) {
  await page.locator('#dialogoAcoes button').nth(0).click();
}
await page.waitForTimeout(4000);
await semDialogo();

// Arquivo 2 de 2
const titulo2 = limpo(await page.textContent('#folhaTitulo').catch(() => ''));
conferir('4. o segundo arquivo abriu automaticamente', /Conferir o extrato/.test(titulo2), titulo2);

// Importar o segundo (último)
await page.click('#folha .btn-ouro:has-text("Importar")'); await page.waitForTimeout(1500);
if (await page.locator('#dialogoFundo.aberta').count()) {
  await page.locator('#dialogoAcoes button').nth(0).click();
}
await page.waitForTimeout(4000);
await semDialogo();

// 5. A folha tem que ter fechado — não pode ficar travada
const folhaAberta = await page.locator('#folha.aberta').count();
conferir('5. a folha fechou depois do último arquivo do lote', folhaAberta === 0, folhaAberta + ' folha(s) aberta(s)');

// 6. Chegou em Transações
const telaAtiva = await page.locator('.tela.ativa').getAttribute('id').catch(() => '');
conferir('6. navegou para Transações', telaAtiva === 'telaTransacoes', telaAtiva);

await page.screenshot({ path: dir+'/z01-lote-fechou.png', fullPage: true });

await browser.close();
try { fs.unlinkSync(arq1); } catch (e) {}
try { fs.unlinkSync(arq2); } catch (e) {}
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }

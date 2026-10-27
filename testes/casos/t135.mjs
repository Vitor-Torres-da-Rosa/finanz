// O botão "Importar extrato desta conta" dentro de Conferir esta conta.
//
// Antes era preciso sair da conferência, ir em Mais → Importar extrato e
// depois escolher a conta. Agora o botão vive no cartão de Extratos
// importados e já pre-seleciona a conta que está sendo conferida.
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

const arquivo = dir + '/t135-extrato-' + process.pid + '.csv';
fs.writeFileSync(arquivo,
  'Data;Descrição;Valor\r\n' +
  '05/09/2026;SALARIO EMPRESA X;3200,00\r\n' +
  '06/09/2026;PIX ENVIADO JOAO;-150,00\r\n', 'utf8');

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t135-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Criar duas contas para testar que a pré-seleção funciona
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(600);
await folha().locator('input.entrada[type=text]').first().fill('Nubank');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1200);
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(600);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1200);

// Navegar até Conferir esta conta do Banco Inter
await page.click('#telaInicio .cartao:has-text("Contas") .linha:has-text("Inter")');
await page.waitForTimeout(1500);
await page.click('#folha .btn-ouro:has-text("Conferir esta conta")'); await page.waitForTimeout(3500);

// 1. O botão "Importar extrato desta conta" aparece
const temBotao = await page.locator('#folha button:has-text("Importar extrato desta conta")').count();
conferir('1. o botão "Importar extrato desta conta" aparece na conferência',
  temBotao === 1, temBotao + ' botão(ões)');
await page.screenshot({ path: dir+'/z01-botao-importar.png', fullPage: true });

// 2. Clicar nele abre o seletor de arquivo e a conferência já vem na conta certa
let fileChooserOk = false;
page.on('filechooser', async (fc) => {
  fileChooserOk = true;
  await fc.setFiles(arquivo);
});

await page.click('#folha button:has-text("Importar extrato desta conta")');
await page.waitForTimeout(5000);

conferir('2. clicou e abriu o seletor de arquivo', fileChooserOk);

// 3. A conferência do extrato abriu
const titulo = limpo(await page.textContent('#folhaTitulo').catch(() => ''));
conferir('3. a conferência do extrato abriu', /Conferir o extrato/.test(titulo), titulo);

// 4. A conta pré-selecionada é Banco Inter, não Nubank
const contaSelecionada = await page.evaluate(() => {
  const sel = document.querySelector('#folha button.selecao .rotulo-valor');
  return sel ? sel.textContent : '(sem seletor)';
});
console.log('conta selecionada:', contaSelecionada);
conferir('4. a conta pré-selecionada é Banco Inter',
  /Inter/.test(contaSelecionada), contaSelecionada);

// 5. Tem as 2 linhas do extrato
const linhas = await page.locator('#folha .item-extrato').count();
conferir('5. o extrato tem 2 linhas', linhas === 2, linhas + ' linha(s)');

await page.screenshot({ path: dir+'/z02-extrato-preselecao.png', fullPage: true });

await browser.close();
try { fs.unlinkSync(arquivo); } catch (e) { /* já foi */ }
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }

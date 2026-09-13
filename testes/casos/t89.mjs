// "Referente a": o app só aponta sozinho quando não há o que escolher.
//
// Um registro na fila  -> já vem apontado.
// Dois na fila         -> fica vazio, quem escolhe é a pessoa.
// Um já parcelado      -> sobra um, e esse vem apontado.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t89'+Date.now()+'-'+process.pid+'@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folhaFechou = () => page.waitForFunction(
  () => !document.getElementById('folha').classList.contains('aberta'), null, { timeout: 20000 });
const referente = () => page.textContent('#folha .campo:has-text("Referente a") .selecao')
  .then((t) => limpo(t).replace(/▾$/, '').trim());

// cliente
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
await page.click('#telaInicio button:has-text("Empreendedor")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .fab, #telaInicio button:has-text("Cadastrar primeiro cliente")'); await page.waitForTimeout(1000);
await page.locator('#folha input.entrada').nth(0).fill('Fabi do juliano');
await page.locator('#folha input[type=tel]').first().fill('51994923028');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await folhaFechou();
await page.click('#telaInicio .linha-alvo:has-text("Fabi do juliano")'); await page.waitForTimeout(1400);

// registro 1: Celular, R$ 1.000,00
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(1000);
await page.locator('#folha .campo:has-text("Valor combinado") input').fill('100000');
await page.locator('#folha input.entrada[type=text]').first().fill('Celular');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2000);
await page.click('#dialogoAcoes button:has-text("Agora não")');
await page.waitForTimeout(1200);

// --- um registro só na fila: já vem apontado ---
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
await page.click('#folha .btn-ouro:has-text("Combinar parcelas")'); await page.waitForTimeout(1400);
const umSo = await referente();
conferir('1. com um registro só, o "Referente a" já vem no Celular', /Celular/.test(umSo), umSo);
await page.screenshot({ path: dir+'/z01-um-so.png', fullPage: true });
await page.goBack(); await page.waitForTimeout(1400);

// --- registro 2: TV, R$ 500,00 ---
await page.click('#folha .aba-cliente button:has-text("Registros")'); await page.waitForTimeout(900);
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(1000);
await page.locator('#folha .campo:has-text("Valor combinado") input').fill('50000');
await page.locator('#folha input.entrada[type=text]').first().fill('TV');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2000);
await page.click('#dialogoAcoes button:has-text("Agora não")');
await page.waitForTimeout(1200);

// --- dois na fila: o app não chuta ---
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
await page.click('#folha .btn-ouro:has-text("Combinar parcelas")'); await page.waitForTimeout(1400);
const dois = await referente();
conferir('2. com dois registros na fila, o "Referente a" fica vazio',
  /Sem registro específico/.test(dois), dois);
await page.screenshot({ path: dir+'/z02-dois.png', fullPage: true });

// escolho o Celular e parcelo só o valor dele, sem acréscimo
await page.click('#folha .campo:has-text("Referente a") .selecao'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Celular")'); await page.waitForTimeout(800);
const valorCombinar = page.locator('#folha .campo:has-text("Valor a combinar") input');
await valorCombinar.click();
for (let i = 0; i < 14; i++) await valorCombinar.press('Backspace');
await valorCombinar.type('100000'); await page.waitForTimeout(700);
await page.click('#folha .campo:has-text("Em quantas vezes") .selecao'); await page.waitForTimeout(600);
await page.click('#escolhaLista .escolha-item:has-text("4x")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(2500);

// --- o Celular saiu da fila: sobrou a TV, e ela vem apontada ---
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
await page.click('#folha .btn-ouro:has-text("Combinar parcelas")'); await page.waitForTimeout(1400);
const sobrou = await referente();
conferir('3. parcelado o Celular, sobra a TV e ela já vem apontada',
  /^TV$/.test(sobrou), sobrou);
await page.screenshot({ path: dir+'/z03-sobrou-tv.png', fullPage: true });
await page.goBack(); await page.waitForTimeout(1400);
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
const paginaParcelas = limpo(await page.textContent('#folha'));
conferir('4. as 4 parcelas do Celular estão na ficha',
  (paginaParcelas.match(/250,00/g) || []).length >= 4, paginaParcelas.slice(0, 90));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: o "Referente a" só aponta sozinho quando não há escolha');

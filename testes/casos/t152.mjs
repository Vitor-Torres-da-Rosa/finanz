// Compartilhar a Venda de Doces com outra conta.
//
// Pedido do Vitor em 03/11/2026: ele e a esposa tocam juntos a venda de
// doces. Ele escolhe o que compartilhar e convida pelo e-mail da conta
// dela; ela aceita dentro do app e os dois veem e mexem nos mesmos
// registros. O resto da conta dele continua só dele.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctxV = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const ctxE = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const vitor = await ctxV.newPage();
const esposa = await ctxE.newPage();
for (const p of [vitor, esposa]) p.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const suf = Date.now().toString(36) + process.pid;
const emailEsposa = 'esposa-t152-' + suf + '@exemplo.com';

async function criarConta(page, nome, email) {
  await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
  await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
  const c = page.locator('.ent-campo input');
  await c.nth(0).fill(nome); await c.nth(1).fill(email); await c.nth(3).fill('senha123');
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3500);
}
async function irParaProdutos(page) {
  await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(600);
  await page.click('#telaInicio .segmentos button:has-text("Empreendedor")').catch(() => {}); await page.waitForTimeout(700);
  if (!(await page.locator('#telaInicio .modulo-cabecalho').count())) { await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900); }
  await page.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await page.waitForTimeout(700);
}
async function novoProduto(page, nome) {
  await page.click('#telaInicio button:has-text("+ Novo produto")'); await page.waitForTimeout(800);
  await page.locator('#folha').getByLabel('Nome do doce').fill(nome);
  for (const [rot, dig] of [['Valor de venda ao cliente final', '400'], ['Repasse para mim', '200']]) {
    const c = page.locator('#folha').getByLabel(rot, { exact: true });
    await c.click(); for (let i = 0; i < 10; i++) await c.press('Backspace'); await c.type(dig);
  }
  await page.click('#folha .btn-ouro:has-text("Salvar produto")'); await page.waitForTimeout(900);
}
async function sincronizar(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(5000);
}
async function reabrir(page) {
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(6000);
}

// ---- a esposa já tem conta, com um doce dela ----
await criarConta(esposa, 'Daniela', emailEsposa);
await esposa.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await esposa.waitForTimeout(800);
await esposa.click('#telaInicio [data-modulo="doces"]'); await esposa.waitForTimeout(900);
await esposa.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await esposa.waitForTimeout(700);
await novoProduto(esposa, 'Doce dela');
await sincronizar(esposa);

// ---- o Vitor tem os doces e um lançamento que é só dele ----
await criarConta(vitor, 'Vitor', 'vitor-t152-' + suf + '@exemplo.com');
await vitor.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await vitor.waitForTimeout(800);
await vitor.click('#telaInicio [data-modulo="doces"]'); await vitor.waitForTimeout(900);
await vitor.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await vitor.waitForTimeout(700);
await novoProduto(vitor, 'Brigadeiro do Vitor');
await sincronizar(vitor);

// ---- convite ----
await vitor.click('#navegacao button:has-text("Mais")'); await vitor.waitForTimeout(900);
await vitor.click('#telaMais .linha:has-text("Compartilhar")'); await vitor.waitForTimeout(1200);
await vitor.click('#folha .btn-ouro:has-text("+ Convidar")'); await vitor.waitForTimeout(800);
await vitor.locator('#folha input[type=email]').fill(emailEsposa);
const marcado = await vitor.$eval('#folha .chip:has-text("Venda de Doces")', b => b.getAttribute('aria-pressed'));
conferir('1. o convite já vem com Venda de Doces marcada', marcado === 'true');
await vitor.screenshot({ path: dir + '/z50-convidar.png', fullPage: true });
await vitor.click('#folha .btn-ouro:has-text("Enviar convite")'); await vitor.waitForTimeout(1500);

// ---- a esposa recebe e aceita ----
await reabrir(esposa);
const dialogo = limpo(await esposa.textContent('#dialogoFundo').catch(() => ''));
conferir('2. ela recebe o convite dentro do app', /Vitor quer compartilhar com você/.test(dialogo) && /Venda de Doces/.test(dialogo), dialogo.slice(0, 120));
await esposa.screenshot({ path: dir + '/z51-convite.png', fullPage: true });
await esposa.click('#dialogoAcoes button:has-text("Aceitar")'); await esposa.waitForTimeout(7000);
await irParaProdutos(esposa);
let telaE = limpo(await esposa.textContent('#telaInicio'));
conferir('3. aceitando, ela vê os doces do Vitor e não os dela', /Brigadeiro do Vitor/.test(telaE) && !/Doce dela/.test(telaE), telaE.slice(0, 200));
conferir('4. e o módulo diz de quem é', /Venda de Doces\s*de Vitor/.test(telaE));
await esposa.screenshot({ path: dir + '/z52-esposa-doces.png', fullPage: true });

// ---- ela cadastra; aparece para ele ----
await novoProduto(esposa, 'Beijinho da esposa');
await sincronizar(esposa);
await reabrir(vitor);
await irParaProdutos(vitor);
const telaV = limpo(await vitor.textContent('#telaInicio'));
conferir('5. o que ela cadastra aparece para ele', /Beijinho da esposa/.test(telaV) && /Brigadeiro do Vitor/.test(telaV) && !/Doce dela/.test(telaV), telaV.slice(0, 220));

// ---- ele cadastra; aparece para ela ----
await novoProduto(vitor, 'Cocada do Vitor');
await sincronizar(vitor);
await reabrir(esposa);
await irParaProdutos(esposa);
telaE = limpo(await esposa.textContent('#telaInicio'));
conferir('6. o que ele cadastra aparece para ela', /Cocada do Vitor/.test(telaE));

// ---- ela sai: o dela volta, o dele fica com ele ----
await esposa.click('#navegacao button:has-text("Mais")'); await esposa.waitForTimeout(900);
await esposa.click('#telaMais .linha:has-text("Compartilhar")'); await esposa.waitForTimeout(1500);
await esposa.click('#folha .linha:has-text("de Vitor")'); await esposa.waitForTimeout(700);
await esposa.click('#dialogoAcoes button:has-text("Sair")'); await esposa.waitForTimeout(8000);
await irParaProdutos(esposa);
telaE = limpo(await esposa.textContent('#telaInicio'));
conferir('7. saindo, os doces dela voltam e os dele somem', /Doce dela/.test(telaE) && !/Brigadeiro do Vitor/.test(telaE), telaE.slice(0, 200));
await reabrir(vitor);
await irParaProdutos(vitor);
conferir('8. e os dele continuam todos com ele', /Brigadeiro do Vitor/.test(limpo(await vitor.textContent('#telaInicio'))) &&
  /Beijinho da esposa/.test(limpo(await vitor.textContent('#telaInicio'))));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: compartilhar a venda de doces');

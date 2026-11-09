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
  for (const [rot, dig] of [['Repasse para mim', '200']]) {
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

// ---- convite: pelo "+ Membro" do Resumo (07/11/2026) ----
await vitor.click('#navegacao button:has-text("Mais")'); await vitor.waitForTimeout(900);
conferir('0. o "Compartilhar" saiu do Mais', !(await vitor.locator('#telaMais .linha:has-text("Compartilhar")').count()));
await irParaProdutos(vitor);
await vitor.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await vitor.waitForTimeout(800);
await vitor.click('#telaInicio button:has-text("+ Membro")'); await vitor.waitForTimeout(800);
await vitor.locator('#folha').getByLabel('Nome').fill('Daniela');
await vitor.locator('#folha').getByLabel('E-mail').fill(emailEsposa);
await vitor.locator('#folha').getByLabel('Parte do lucro (%)').fill('50');
await vitor.screenshot({ path: dir + '/z50-convidar.png', fullPage: true });
await vitor.click('#folha .btn-ouro:has-text("Salvar membro")'); await vitor.waitForTimeout(2500);
await vitor.click('#telaInicio .linha:has-text("Daniela")'); await vitor.waitForTimeout(900);
const sitConvite = limpo(await vitor.textContent('#folha'));
conferir('1. o membro com e-mail recebe o convite da Venda de Doces', /Convite enviado: falta Daniela aceitar/.test(sitConvite), sitConvite.slice(0, 160));
for (let i = 0; i < 3 && await vitor.locator('#folha.aberta').count(); i++) { await vitor.goBack(); await vitor.waitForTimeout(600); }

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

// ---- ajuste de estoque precisa do sócio ----
await esposa.click('#telaInicio .linha:has-text("Cocada do Vitor")'); await esposa.waitForTimeout(800);
await esposa.click('#folha button:has-text("Ajustar estoque")'); await esposa.waitForTimeout(800);
await esposa.locator('#folha .contador-campo').fill('10');
await esposa.locator('#folha input[placeholder^="Ex.: contagem"]').fill('contei em casa');
await esposa.click('#folha .btn-ouro:has-text("Pedir confirmação")'); await esposa.waitForTimeout(1000);
for (let i = 0; i < 3 && await esposa.locator('#folha.aberta').count(); i++) { await esposa.goBack(); await esposa.waitForTimeout(600); }
telaE = limpo(await esposa.textContent('#telaInicio'));
conferir('6a. o pedido dela fica esperando, sem mudar o estoque',
  /Ajustes de estoque para confirmar.*Cocada do Vitor · \+10 un\..*você pediu.*esperando/.test(telaE) && /Cocada do Vitor\s*Estoque 0 un\./.test(telaE), telaE.slice(0, 260));
await sincronizar(esposa);
await reabrir(vitor);
await irParaProdutos(vitor);
let tv = limpo(await vitor.textContent('#telaInicio'));
conferir('6b. ele vê o pedido dela para confirmar', /Cocada do Vitor · \+10 un\..*Daniela pediu · contei em casa\s*confirmar/.test(tv), tv.slice(0, 260));
await vitor.click('#telaInicio .cartao-ajustes .linha:has-text("Cocada do Vitor")'); await vitor.waitForTimeout(700);
await vitor.click('#escolhaLista .escolha-item:has-text("Confirmar")'); await vitor.waitForTimeout(1000);
tv = limpo(await vitor.textContent('#telaInicio'));
conferir('6c. confirmado, entra no estoque', !/Ajustes de estoque para confirmar/.test(tv) && /Cocada do Vitor\s*Estoque 10 un\./.test(tv), tv.slice(0, 200));
await sincronizar(vitor);

// ---- ela sai pelo Resumo dos Doces: o dela volta, o dele fica com ele ----
await irParaProdutos(esposa);
await esposa.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await esposa.waitForTimeout(800);
await esposa.click('#telaInicio .cartao-compartilhado .linha:has-text("Compartilhado por Vitor")'); await esposa.waitForTimeout(700);
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

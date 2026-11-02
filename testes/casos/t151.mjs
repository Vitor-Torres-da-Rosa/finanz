// Fornecedor nos Doces: compras do produto, entrada no estoque e o custo.
//
// Pedido do Vitor em 03/11/2026: "uma aba chamada fornecedor, onde vai
// estar listado as compras dos produtos e as entradas e custos de
// entradas de estoque" — num lugar que não estrague o layout. As quatro
// abas de cima já enchem a linha; Fornecedor mora dentro de Produtos.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const tela = async () => limpo(await page.textContent('#telaInicio'));
const dinheiro = async (loc, digitos) => {
  await loc.click(); for (let i = 0; i < 12; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(150);
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t151-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900);
await page.click('#telaInicio button:has-text("+ Novo vendedor")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome', { exact: true }).fill('Daniela');
await page.click('#folha .btn-ouro:has-text("Salvar vendedor")'); await page.waitForTimeout(900);
await page.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await page.waitForTimeout(600);
const abas = await page.$$eval('#telaInicio .abas-modulo button', ns => ns.map(n => n.textContent.trim()));
conferir('1. as abas de cima continuam quatro', abas.length === 4, abas.join('|'));
await page.click('#telaInicio button:has-text("+ Novo produto")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome do doce').fill('Pote de vidro');
await dinheiro(folha().getByLabel('Valor de venda ao cliente final', { exact: true }), '2500');
await dinheiro(folha().getByLabel('Repasse para mim', { exact: true }), '600');
await page.click('#folha .btn-ouro:has-text("Salvar produto")'); await page.waitForTimeout(1000);

// ---- Fornecedor ----
await page.click('#telaInicio .sub-produtos button:has-text("Fornecedor")'); await page.waitForTimeout(700);
await page.click('#telaInicio button:has-text("+ Nova compra")'); await page.waitForTimeout(800);
await dinheiro(folha().locator('.valor-grande'), '15000');
await folha().locator('.contador-campo').fill('100'); await page.waitForTimeout(300);
await folha().getByLabel('Fornecedor (opcional)').fill('Atacadão');
const prev = limpo(await folha().textContent());
conferir('2. a compra mostra o custo de cada unidade', /Custo de cada unidade\s*R\$ 1,50/.test(prev), (prev.match(/Custo de cada.{0,20}/) || [''])[0]);
await page.screenshot({ path: dir + '/z48-nova-compra.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Registrar compra")'); await page.waitForTimeout(1000);
let t = await tela();
conferir('3. a compra aparece na lista com fornecedor e custo', /Pote de vidro · 100 un\..*Atacadão · R\$ 1,50 cada.*− R\$ 150,00/.test(t), t.slice(0, 300));
conferir('4. o estoque é de 100 unidades e o gasto do mês R$ 150,00', /Seu estoque.*Pote de vidro.*100 un\./.test(t) && /Gasto em compras\s*R\$ 150,00/.test(t));
await page.screenshot({ path: dir + '/z49-fornecedor.png', fullPage: true });

// O valor de compra do produto passou a ser R$ 1,50.
await page.click('#telaInicio .sub-produtos button:has-text("Produtos")'); await page.waitForTimeout(600);
conferir('5. o produto ganhou o valor de compra da compra', /Compra R\$ 1,50/.test(await tela()));

// Entrega de 30 para a Daniela: o seu estoque cai para 70.
await page.click('#fab'); await page.waitForTimeout(900);
await folha().locator('.contador-campo').fill('30'); await page.waitForTimeout(300);
await page.click('#folha .btn-ouro:has-text("Registrar entrega")'); await page.waitForTimeout(1000);
await page.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await page.waitForTimeout(600);
await page.click('#telaInicio .sub-produtos button:has-text("Fornecedor")'); await page.waitForTimeout(700);
conferir('6. entregando 30, ficam 70 com você', /Seu estoque.*Pote de vidro.*70 un\./.test(await tela()));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: fornecedor dos doces');

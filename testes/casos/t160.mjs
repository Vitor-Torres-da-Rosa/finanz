// Compra de vários doces com um valor só (pedido do Vitor em 08/11/2026):
// marca 10 temperos, 10 doces de vidro e 10 potes, paga um total, e o app
// divide entre eles — pelo valor de compra de cada um quando todos têm,
// senão por unidade.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const tela = async () => limpo(await page.textContent('#telaInicio'));
const dinheiro = async (loc, digitos) => { await loc.click(); for (let i = 0; i < 14; i++) await loc.press('Backspace'); await loc.type(digitos); await page.waitForTimeout(150); };

await page.clock.setFixedTime(new Date(2026, 10, 8, 15, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t160-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Três doces com valor de compra: tempero R$ 1,00, doce de vidro R$ 3,00, pote R$ 2,00.
await page.evaluate(() => new Promise(res => {
  const s = Math.random().toString(36).slice(2);
  const dados = { contas: [{ id: 'cc' + s, nome: 'Banco', tipo: 'Conta corrente', saldoInicial: 0 }], lancamentos: [],
    doceProdutos: [{ id: 'pt' + s, nome: 'Tempero', preco: 500, repasse: 300, custo: 100 },
                   { id: 'pv' + s, nome: 'Doce de vidro', preco: 1000, repasse: 600, custo: 300 },
                   { id: 'pp' + s, nome: 'Pote', preco: 800, repasse: 500, custo: 200 }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(900);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900);
await page.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await page.waitForTimeout(600);
await page.click('#telaInicio .sub-produtos button:has-text("Fornecedor")'); await page.waitForTimeout(700);

await page.click('#telaInicio button:has-text("+ Nova compra")'); await page.waitForTimeout(800);
const itens = await page.$$eval('#folha .item-compra strong', ns => ns.map(n => n.textContent));
conferir('1. a compra lista todos os doces cadastrados', itens.length === 3 && itens.includes('Tempero') && itens.includes('Pote'), itens.join(', '));
await dinheiro(folha().locator('.valor-grande'), '6600');
for (const nome of ['Tempero', 'Doce de vidro', 'Pote']) {
  await folha().locator('.item-compra:has-text("' + nome + '") .contador-campo').fill('10'); await page.waitForTimeout(150);
}
await folha().getByLabel('Fornecedor (opcional)').fill('Paulo fornecedor');
const prev = limpo(await folha().textContent());
// Pesos 10×1 + 10×3 + 10×2 = 60: 66 × 10/60 = 11, × 30/60 = 33, × 20/60 = 22.
conferir('2. o valor pago se divide pelo valor de compra de cada um',
  /Tempero.*R\$ 11,00 desta compra · R\$ 1,10 cada/.test(prev) && /Doce de vidro.*R\$ 33,00 desta compra · R\$ 3,30 cada/.test(prev) &&
  /Pote.*R\$ 22,00 desta compra · R\$ 2,20 cada/.test(prev) && /3 doce\(s\) · 30 un\.\s*R\$ 2,20 em média/.test(prev), prev.slice(0, 500));
await page.screenshot({ path: dir + '/z76-compra-varios.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Registrar compra")'); await page.waitForTimeout(1000);
let t = await tela();
conferir('3. na lista, uma compra só com o total', /3 doces · 30 un\.\s*08\/11\/2026 · Paulo fornecedor · [^−]*Tempero[^−]*− R\$ 66,00/.test(t) && /Gasto em compras\s*R\$ 66,00/.test(t), t.slice(0, 500));
conferir('4. e cada doce entra no seu estoque', /Tempero\s*com você agora\s*10 un\./.test(t) && /Doce de vidro\s*com você agora\s*10 un\./.test(t) && /Pote\s*com você agora\s*10 un\./.test(t));

// ---- editar: tirar o pote ----
await page.click('#telaInicio .linha:has-text("3 doces")'); await page.waitForTimeout(800);
const q = await folha().locator('.item-compra:has-text("Pote") .contador-campo').inputValue();
conferir('5. editando, as quantidades voltam', q === '10', q);
await folha().locator('.item-compra:has-text("Pote") .contador-campo').fill('0'); await page.waitForTimeout(150);
await dinheiro(folha().locator('.valor-grande'), '4400');
await page.click('#folha .btn-ouro:has-text("Salvar compra")'); await page.waitForTimeout(1000);
t = await tela();
conferir('6. o doce que saiu deixa a compra', /2 doces · 20 un\..*− R\$ 44,00/.test(t) && !/Pote\s*com você agora\s*10 un/.test(t), t.slice(0, 500));

// ---- excluir apaga a compra inteira ----
await page.click('#telaInicio .linha:has-text("2 doces")'); await page.waitForTimeout(800);
await page.click('#folha button:has-text("Excluir compra")'); await page.waitForTimeout(500);
await page.click('#dialogoAcoes button:has-text("Excluir")'); await page.waitForTimeout(1000);
t = await tela();
conferir('7. excluindo, sai a compra toda', /Nenhuma compra ainda/.test(t) && /Gasto em compras\s*R\$ 0,00/.test(t), t.slice(0, 300));

console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\ntudo certo: compra de vários doces');
await browser.close();
process.exit(falhas ? 1 : 0);

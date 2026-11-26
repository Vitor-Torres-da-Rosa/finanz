// Estoque e Ferramentas (pedido do Vitor em 25/11/2026): ferramentas com
// compra, valor, vida útil, usos e manutenção; consumíveis com quantidade,
// mínimo, entradas e saídas rápidas; custo por obra e estimativa de obra.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');

await page.goto(ENDERECO, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('finanz.cofre.auto', 'senha-do-cofre-123'); sessionStorage.clear(); sessionStorage.setItem('finanz.privado', '0'); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t199-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3500);

await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
const cartaoEst = limpo(await page.textContent('#telaInicio [data-modulo="estoque"]').catch(() => ''));
conferir('1. o Empreendedor ganhou o quadro "Estoque e Ferramentas"', /Estoque e Ferramentas/.test(cartaoEst) && /Valor em estoque/.test(cartaoEst), cartaoEst);
await page.click('#telaInicio [data-modulo="estoque"]'); await page.waitForTimeout(900);
const aba = async (nome) => { await page.click('#telaInicio .abas-modulo button:has-text("' + nome + '")'); await page.waitForTimeout(700); };

// ---- ferramenta ----
await aba('Ferramentas');
await page.click('#telaInicio .cartao-acao:has-text("+ Novo")'); await page.waitForTimeout(700);
await folha().locator('.campo-nome-item').fill('Esmerilhadeira 4½');
await folha().locator('.campo-valor-item').fill('30000');
await folha().locator('.campo-vida-util').fill('300');
await folha().locator('.botao-salvar-item').click(); await page.waitForTimeout(900);
let lista = limpo(await page.textContent('#telaInicio'));
conferir('2. ferramenta cadastrada com valor e custo por uso', /Esmerilhadeira 4½/.test(lista) && /R\$ 300,00/.test(lista) && /R\$ 1,00\/uso/.test(lista), lista.slice(0, 200));

await page.click('#telaInicio .botao-obra-hoje'); await page.waitForTimeout(700);
await folha().locator('.campo-obra-nova').fill('Casa da Ana');
await folha().locator('.btn-ouro:has-text("Usar esta obra")').click(); await page.waitForTimeout(800);
await page.click('#telaInicio .botao-usei-hoje'); await page.waitForTimeout(800);
lista = limpo(await page.textContent('#telaInicio'));
conferir('3. "Usei hoje" anota com um toque, na obra de hoje', /Obra de hoje: Casa da Ana/.test(lista) && /1 uso · último hoje/.test(lista), lista.slice(0, 260));

await page.click('#telaInicio .est-acoes button:has-text("Manutenção")'); await page.waitForTimeout(700);
await folha().locator('.campo-valor-mov').fill('5000');
await folha().locator('.campo-desc-mov').fill('troca das escovas');
await folha().locator('.botao-salvar-mov').click(); await page.waitForTimeout(800);
await page.click('#telaInicio .est-item .linha'); await page.waitForTimeout(900);
const ficha = limpo(await folha().textContent());
conferir('4. a ficha mostra usos, manutenção e o histórico', /Usos\s*1/.test(ficha) && /Manutenção\s*R\$ 50,00/.test(ficha) && /troca das escovas/.test(ficha) && /Casa da Ana/.test(ficha), ficha.slice(0, 300));
await page.screenshot({ path: dir + '/z199-ficha-ferramenta.png' });
await page.goBack(); await page.waitForTimeout(700);

// ---- consumível ----
await aba('Consumíveis');
await page.click('#telaInicio .cartao-acao:has-text("+ Novo")'); await page.waitForTimeout(700);
await folha().locator('.campo-nome-item').fill('Disco de corte');
await folha().locator('.campo-qtd-inicial').fill('10');
await folha().locator('.campo-valor-item').fill('450');
await folha().locator('.campo-minimo').fill('3');
await folha().locator('.botao-salvar-item').click(); await page.waitForTimeout(900);
lista = limpo(await page.textContent('#telaInicio'));
conferir('5. consumível com 10 unidades e custo da unidade', /Disco de corte/.test(lista) && /10 un/.test(lista) && /R\$ 4,50\/un/.test(lista), lista.slice(0, 260));
for (let i = 0; i < 8; i++) { await page.click('#telaInicio .botao-menos-um'); await page.waitForTimeout(250); }
lista = limpo(await page.textContent('#telaInicio'));
conferir('6. "−1 usei" tira uma a uma; no mínimo fica vermelho, "acabando"', /2 un/.test(lista) && /acabando/.test(lista) &&
  await page.locator('#telaInicio .est-item .linha-valor.vermelho').count() === 1, lista.slice(0, 260));
await page.screenshot({ path: dir + '/z199-consumiveis.png' });
await aba('Resumo');
const resumo = limpo(await page.textContent('#telaInicio'));
conferir('7. o Resumo mostra o "Acabando" e o valor em estoque', /Acabando/.test(resumo) && /Disco de corte/.test(resumo) && /Valor em estoque/.test(resumo), resumo.slice(0, 300));
await page.screenshot({ path: dir + '/z199-resumo.png' });
await aba('Consumíveis');
await page.click('#telaInicio .botao-entrada'); await page.waitForTimeout(700);
await folha().locator('.campo-qtd-mov').fill('20');
await folha().locator('.campo-valor-mov').fill('8000');
await folha().locator('.botao-salvar-mov').click(); await page.waitForTimeout(800);
lista = limpo(await page.textContent('#telaInicio'));
conferir('8. "+ Entrada" soma e o custo passa a ser o da última compra', /22 un/.test(lista) && /R\$ 4,00\/un/.test(lista) && !/acabando/.test(lista), lista.slice(0, 260));

// ---- várias de uma vez ----
await aba('Resumo');
await page.click('#telaInicio .botao-registrar-uso'); await page.waitForTimeout(800);
await folha().locator('.est-linha-passo:has-text("Disco de corte") .passo-mais').click();
await folha().locator('.est-linha-passo:has-text("Disco de corte") .passo-mais').click();
await folha().locator('.est-linha-passo:has-text("Esmerilhadeira") .passo-mais').click();
await folha().locator('.botao-salvar-uso').click(); await page.waitForTimeout(900);
await aba('Consumíveis');
conferir('9. "Registrar uso" anota várias de uma vez', /20 un/.test(limpo(await page.textContent('#telaInicio'))));

// ---- obras ----
await aba('Obras');
const obras = limpo(await page.textContent('#telaInicio'));
// 10 discos × R$ 4,00 = R$ 40,00; 2 usos × (R$ 1,00 + R$ 50,00 ÷ 2) = R$ 52,00
conferir('10. o custo da obra soma consumíveis e usos de ferramenta', /Casa da Ana/.test(obras) && /consumíveis R\$ 40,00/.test(obras) && /ferramentas R\$ 52,00/.test(obras) && /R\$ 92,00/.test(obras), obras.slice(0, 300));
await page.screenshot({ path: dir + '/z199-obras.png' });

// ---- estimar ----
await aba('Resumo');
await page.click('#telaInicio .botao-estimar-obra'); await page.waitForTimeout(800);
await folha().locator('.chip:has-text("Casa da Ana")').click(); await page.waitForTimeout(300);
await folha().locator('.campo-mao-de-obra').fill('50000');
await folha().locator('.campo-mao-de-obra').dispatchEvent('input'); await page.waitForTimeout(200);
const est = limpo(await folha().locator('.est-total').textContent());
conferir('11. estimar a partir de uma obra feita: material + mão de obra', /Material R\$ 92,00/.test(est) && /R\$ 592,00/.test(est), est);
await page.screenshot({ path: dir + '/z199-estimar.png' });
await page.goBack(); await page.waitForTimeout(600);

// ---- nuvem ----
await page.waitForTimeout(4000);
const nuvem = await page.evaluate(async () => {
  try { return await window.__finanzTeste.tabela('empreendedor_registros'); } catch (e) { return []; }
});
const tipos = nuvem.map(x => x.tipo);
conferir('12. sobe para a nuvem com o resto do Empreendedor', tipos.filter(t => t === 'estoque_item').length === 2 && tipos.filter(t => t === 'estoque_mov').length >= 5, tipos.length);
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3000);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")').catch(() => {}); await page.waitForTimeout(800);
const depois = limpo(await page.textContent('#telaInicio [data-modulo="estoque"]'));
conferir('13. o quadro do Empreendedor mostra o valor em estoque', /R\$ 380,00/.test(depois), depois);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

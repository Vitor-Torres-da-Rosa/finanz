// Importação com subcategoria: o app já chuta pelo texto do extrato, e dá
// para conferir e trocar na própria lista, como acontece com a categoria.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let arquivo = amostras + '/c6-repetido.pdf';
page.on('filechooser', async fc => { await fc.setFiles(arquivo); });
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t93'+Date.now()+'-'+process.pid+'@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
await page.click('#telaMais label.linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .cabeca-banco', { timeout: 40000 }); await page.waitForTimeout(800);

const etiquetas = () => page.$$eval('#folha .item-extrato .etiqueta-cat',
  ns => ns.map(x => x.textContent.trim()));
const linhas = () => page.$$eval('#folha .item-extrato',
  ns => ns.map(x => x.textContent.replace(/\s+/g, ' ').trim()));

const antes = await linhas();
antes.slice(0, 5).forEach(l => console.log('  *', l));
const tags = await etiquetas();
console.log('etiquetas:', tags.join(' | '));
conferir('1. cada lançamento tem duas etiquetas: categoria e subcategoria',
  tags.length === antes.length * 2, tags.length + ' para ' + antes.length + ' linhas');
conferir('2. onde o app não identificou, a etiqueta convida a escolher',
  tags.indexOf('+ subcategoria') >= 0);
await page.screenshot({ path: dir+'/x01-importar.png', fullPage: true });

// O app já acertou o da oficina sozinho: Transporte · Manutenção.
conferir('2b. o texto do extrato já traz a subcategoria quando dá para saber',
  antes.some(l => /OFICINA/.test(l) && /Transporte/.test(l) && /Manutenção/.test(l)),
  (antes.find(l => /OFICINA/.test(l)) || '?'));

// --- escolher a subcategoria de um lançamento ---
// O primeiro é "Outros", que não tem subcategoria nenhuma de fábrica; pego
// uma linha cuja categoria tenha lista para escolher.
const qual = antes.findIndex(l => /OFICINA/.test(l));
const bloco = () => page.locator('#folha .item-extrato').nth(qual);
const subDele = () => bloco().locator('.etiqueta-cat').nth(1);
const catDele = () => bloco().locator('.etiqueta-cat').first();
const categoria = limpo(await catDele().textContent());
console.log('categoria escolhida para o teste:', categoria);
await subDele().click(); await page.waitForTimeout(900);
const titulo = limpo(await page.textContent('#escolhaTitulo').catch(() => ''));
console.log('seletor:', titulo);
conferir('3. o seletor abre nas subcategorias daquela categoria',
  titulo.indexOf('Subcategoria de ' + categoria) === 0, titulo);
const opcoes = await page.$$eval('#escolhaLista .escolha-item', ns => ns.map(x => x.textContent.replace(/[✓\s]+/g, ' ').trim()));
const rodape = limpo(await page.textContent('#escolhaRodape'));
console.log('opções:', opcoes.slice(0, 8).join(', '), '| rodapé:', rodape);
conferir('4. tem "Sem subcategoria" na lista e "+ Criar subcategoria" no rodapé',
  opcoes.some(o => /Sem subcategoria/.test(o)) && /Criar subcategoria/.test(rodape));
conferir('4b. a subcategoria que o app achou já vem marcada',
  /Manutenção/.test(limpo(await subDele().textContent())), limpo(await subDele().textContent()));
await page.screenshot({ path: dir+'/x02-seletor.png', fullPage: true });

await page.click('#escolhaLista .escolha-item:has-text("Pedágio")'); await page.waitForTimeout(1200);
conferir('5. a etiqueta passou a mostrar a subcategoria escolhida',
  limpo(await subDele().textContent()) === 'Pedágio', limpo(await subDele().textContent()));

// --- trocar a categoria limpa a subcategoria, que era da categoria antiga ---
await catDele().click(); await page.waitForTimeout(900);
await page.click('#escolhaLista .escolha-item:has-text("Família")'); await page.waitForTimeout(1200);
for (let i = 0; i < 4 && await page.locator('#dialogoAcoes').count(); i++) {
  await page.click('#dialogoAcoes button:has-text("Só este")').catch(() => {});
  await page.waitForTimeout(900);
}
conferir('6. trocando a categoria, a subcategoria antiga não fica pendurada',
  limpo(await subDele().textContent()) === '+ subcategoria',
  limpo(await catDele().textContent()) + ' / ' + limpo(await subDele().textContent()));

// --- lançar e conferir que a subcategoria chegou no lançamento ---
await subDele().click(); await page.waitForTimeout(900);
await page.click('#escolhaLista .escolha-item:has-text("Filhos")'); await page.waitForTimeout(1200);
await page.click('#folha .selecao'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Criar conta")'); await page.waitForTimeout(1400);
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Sim")'); await page.waitForTimeout(3000);

await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1600);
const transacoes = limpo(await page.textContent('#telaTransacoes'));
console.log('transações:', transacoes.slice(0, 260));
conferir('7. o lançamento entrou com Família · Filhos', /Família · Filhos/.test(transacoes));
await page.screenshot({ path: dir+'/x03-lancado.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: subcategoria na importação, chutada e trocável');

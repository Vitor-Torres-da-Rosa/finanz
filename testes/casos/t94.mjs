// Novo cartão: o tipo não se pergunta (já está decidido) e os dois dias da
// fatura viram a conta que a pessoa usa — o melhor dia para comprar.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t94'+Date.now()+'-'+process.pid+'@exemplo.com'); await c.nth(3).fill('senha123');
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
const visiveis = () => page.$$eval('#folha .campo',
  ns => ns.filter(n => n.offsetParent !== null).map(n => (n.querySelector('label') || {}).textContent || ''));

// --- nova conta: cartão sai da lista de tipos ---
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
await page.locator('#telaInicio .cartao-acao', { hasText: '+ Nova' }).first().click({ force: true });
await page.waitForTimeout(1300);
conferir('1. "Nova conta" ainda pergunta o tipo',
  (await visiveis()).some(t => /Tipo/.test(t)));
await page.click('#folha .campo:has-text("Tipo") .selecao'); await page.waitForTimeout(800);
const tipos = await page.$$eval('#escolhaLista .escolha-item', ns => ns.map(x => x.textContent.replace(/[✓\s]+/g, ' ').trim()));
console.log('tipos oferecidos numa conta:', tipos.join(', '));
conferir('2. mas cartão de crédito não está entre eles: ele nasce do outro lado',
  !tipos.some(t => /Cartão de crédito/.test(t)), tipos.join(', '));
await page.click('#escolhaRodape button:has-text("Cancelar")'); await page.waitForTimeout(700);
await page.click('#folha .campo:has-text("Banco") .selecao'); await page.waitForTimeout(800);
await page.locator('#escolhaLista').getByText('C6 Bank', { exact: true }).click(); await page.waitForTimeout(900);
await page.click('#folha .btn-ouro:has-text("Salvar")'); await folhaFechou();
// A lista de bancos do cartão sai das contas, então espero a conta aparecer
// de verdade antes de abrir a folha do cartão.
await page.locator('#telaInicio .cartao', { hasText: 'Contas' }).getByText('C6 Bank').first()
  .waitFor({ timeout: 20000 });
await page.waitForTimeout(600);

// --- novo cartão: sem campo de tipo ---
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
await page.locator('#telaInicio .cartao-acao', { hasText: '+ Novo' }).first().click({ force: true });
await page.waitForTimeout(1300);
conferir('3. a folha é a do cartão', /Novo cartão/.test(await page.textContent('#folhaTitulo')));
const campos = await visiveis();
console.log('campos visíveis:', campos.join(' | '));
conferir('4. não pergunta o tipo', !campos.some(t => /^Tipo$/.test(t.trim())), campos.join(' | '));
conferir('5. pergunta o melhor dia de compra e o vencimento, e mostra o fechamento',
  campos.some(t => /Melhor dia de compra/.test(t)) && campos.some(t => /Vence no dia/.test(t)) &&
  campos.some(t => /A fatura fecha no dia/.test(t)) && !campos.some(t => /^Fecha no dia$/.test(t.trim())),
  campos.join(' | '));

// --- no cartão, o banco só oferece os que a pessoa já usa ---
await page.click('#folha .campo:has-text("Banco") .selecao'); await page.waitForTimeout(800);
const bancos = await page.$$eval('#escolhaLista .escolha-item', ns => ns.map(x => x.textContent.replace(/[✓\s]+/g, ' ').trim()));
console.log('bancos num cartão:', bancos.join(', '));
conferir('5b. no cartão o banco começa só com os que eu já uso',
  bancos.length === 3 && bancos.some(b => /Nenhum \/ outro/.test(b)) &&
  bancos.some(b => /^C6 Bank$/.test(b)) && bancos.some(b => /Ver todos os bancos/.test(b)),
  bancos.join(', '));

// Mas não tranca: "Ver todos os bancos" abre a lista inteira.
await page.locator('#escolhaLista').getByText('Ver todos os bancos', { exact: true }).click();
await page.waitForTimeout(1100);
const todos = await page.$$eval('#escolhaLista .escolha-item', ns => ns.map(x => x.textContent.replace(/[✓\s]+/g, ' ').trim()));
console.log('depois de "ver todos":', todos.length, 'bancos');
conferir('5c. "Ver todos os bancos" abre a lista inteira', todos.length > 5, String(todos.length));

await page.click('#escolhaRodape button:has-text("Cancelar")'); await page.waitForTimeout(700);

const nota = () => page.$$eval('#folha .linha-nota',
  ns => ns.filter(n => n.offsetParent !== null).map(n => n.textContent.replace(/\s+/g, ' ').trim()).join(' ~ '));
const campoMelhor = () => page.textContent('#folha .melhor-dia').then(t => (t || '').replace(/\s+/g, ' ').trim());
console.log('nota sem os dias:', await nota());
conferir('6. sem o melhor dia, o campo diz do que depende em vez de inventar',
  /Depende do melhor dia de compra/.test(await campoMelhor()), await campoMelhor());

await page.click('#folha .campo:has-text("Melhor dia de compra") .selecao'); await page.waitForTimeout(800);
await page.locator('#escolhaLista').getByText('Dia 4', { exact: true }).click(); await page.waitForTimeout(900);
console.log('campo só com o melhor dia:', await campoMelhor());
conferir('7. do melhor dia 4 o app tira o fechamento no dia 3',
  /^Dia 3$/.test(await campoMelhor()), await campoMelhor());

await page.click('#folha .campo:has-text("Vence no dia") .selecao'); await page.waitForTimeout(800);
await page.locator('#escolhaLista').getByText('Dia 13', { exact: true }).click(); await page.waitForTimeout(900);
const completa = await campoMelhor();
const explicacao = await nota();
console.log('campo completo:', completa, '| nota:', explicacao);
conferir('8. com os dois, o campo mostra o fechamento e o prazo, e a nota mostra a data',
  /Dia 3/.test(completa) && /\d+ dias para pagar/.test(completa) &&
  /Comprando no dia 4/.test(explicacao) &&
  /a fatura só vence em \d{2}\/\d{2}\/\d{4}/.test(explicacao), completa + ' ~ ' + explicacao);
// "Dia 4" e "39 dias" ficam colados no textContent; leio o pedaço certo.
const dias = +(await page.textContent('#folha .melhor-dia-prazo')).replace(/\D/g, '');
conferir('9. a conta bate: comprando dia 4, fecha dia 3 do mês seguinte e vence dia 13',
  dias >= 38 && dias <= 41, String(dias));
await page.screenshot({ path: dir+'/s01-cartao.png', fullPage: true });

// --- e o cartão salva como cartão, não como conta corrente ---
await page.locator('#folha input.entrada[type=text]').first().fill('C6 Bank cartão');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await folhaFechou(); await page.waitForTimeout(1600);
const inicio = limpo(await page.textContent('#telaInicio'));
conferir('10. ele entrou na lista de cartões, não na de contas',
  /Cartões.*C6 Bank cartão/.test(inicio) && !/Contas\+ NovaC6 Bank cartão/.test(inicio),
  (inicio.match(/Cartões.{0,60}/) || ['?'])[0]);

// Reabrindo, o melhor dia volta como 4: o app guardou o fechamento (3) e
// mostra de novo o dia que a pessoa escolheu.
await page.locator('#telaInicio .cartao:has-text("Cartões") .linha-acao').first().click({ force: true });
await page.waitForTimeout(1400);
const melhorReaberto = limpo(await page.textContent('#folha .campo:has-text("Melhor dia de compra") .selecao'));
conferir('11. reabrindo, o melhor dia volta como dia 4',
  /Dia 4/.test(melhorReaberto), melhorReaberto);
conferir('12. e o fechamento derivado continua sendo o dia 3',
  /Dia 3/.test(await campoMelhor()), await campoMelhor());

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: novo cartão sem tipo, com o melhor dia de compra calculado');

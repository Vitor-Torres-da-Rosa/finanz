// As transferências achadas aparecem na aba de Transferências.
//
// Pedido do Vitor em 25/10/2026, com um print da aba vazia: "coloca todas
// as transferências entre contas que já foram achadas e que foram
// ocultadas no app, elas devem aparecer em transferências".
//
// A tela inicial dizia "achei 9 saídas com o mesmo valor de entradas em
// outras contas" e a aba de Transferências dizia "Nenhum lançamento" — as
// duas certas pela lógica de antes, e a soma delas sem sentido nenhum. A
// aba mostrava só os pares já JUNTADOS; os achados e os deixados como
// estão continuam guardados como saída e entrada, e sumiam dali.
import { chromium, dir, ENDERECO } from '../comum.mjs';
import { tocarFab } from '../comum.mjs';
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
const porDinheiro = async (loc, d) => {
  await loc.click();
  for (let i = 0; i < 16; i++) await loc.press('Backspace');
  await loc.type(d);
  await page.waitForTimeout(300);
};
const irParaInicio = async () => {
  for (let i = 0; i < 8; i++) {
    if (await page.locator('#telaInicio:visible').count()) return;
    await page.locator('#navegacao button').nth(1).click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    await page.locator('#navegacao button').nth(0).click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }
};
const novaConta = async (nome) => {
  await irParaInicio();
  await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
  await folha().locator('input.entrada[type=text]').first().fill(nome);
  await page.click('#folha .btn-ouro'); await page.waitForTimeout(1500);
};
// Um lançamento numa conta escolhida pelo nome.
const lancar = async (tipo, nome, valor, conta) => {
  await irParaInicio();
  await tocarFab(page); await page.waitForTimeout(1000);
  if (tipo === 'entrada') { await page.click('#folha button:has-text("Entrada")'); await page.waitForTimeout(800); }
  await porDinheiro(folha().locator('.valor-grande'), valor);
  await folha().locator('input.entrada[type=text]').first().fill(nome);
  // O seletor de conta não é um <select>: é um botão que abre a folha de
  // escolha. Escolho pelo nome da conta ali dentro.
  const sel = folha().locator('.selecao', { hasText: /Banco Inter|C6 Bank|Carteira/ }).first();
  if (await sel.count()) {
    await sel.click(); await page.waitForTimeout(900);
    await page.click('#escolhaLista .escolha-item:has-text("' + conta + '")');
    await page.waitForTimeout(900);
  }
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
};
const abrirTransferencias = async () => {
  await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1500);
  await page.click('#telaTransacoes button:has-text("Transferências")'); await page.waitForTimeout(1200);
  return limpo(await page.textContent('#telaTransacoes'));
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t127-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await novaConta('Banco Inter');
await novaConta('C6 Bank');

// O par: sai 500 do Inter, entra 500 no C6. O app reconhece isso como
// transferência, mas eles continuam guardados como saída e entrada.
await lancar('saida', 'Pix enviado', '50000', 'Banco Inter');
await lancar('entrada', 'Pix recebido', '50000', 'C6 Bank');
await page.waitForTimeout(2500);

const naAba = await abrirTransferencias();
console.log('aba:', naAba.slice(0, 300));
conferir('1. o par achado aparece na aba de Transferências',
  /parecem transferência/.test(naAba), naAba.slice(0, 160));
conferir('2. dizendo de onde para onde', /Banco Inter → C6 Bank/.test(naAba),
  (naAba.match(/Banco Inter → C6 Bank/) || ['(não achei)'])[0]);
conferir('3. e que ainda não foi juntada', /ainda não juntada/.test(naAba),
  (naAba.match(/ainda não juntada/) || ['(não achei)'])[0]);
await page.screenshot({ path: dir+'/z25-pares-na-aba.png', fullPage: true });

// ---- deixar como está: continua aparecendo, com a resposta registrada ----
await page.click('#telaTransacoes .linha:has-text("Banco Inter → C6 Bank")'); await page.waitForTimeout(1200);
conferir('4. tocando nele, dá para juntar ou deixar como está',
  /Juntar/.test(limpo(await page.textContent('#dialogoAcoes').catch(() => ''))) &&
  /Deixar como está/.test(limpo(await page.textContent('#dialogoAcoes').catch(() => ''))),
  limpo(await page.textContent('#dialogoAcoes').catch(() => '')));
await page.click('#dialogoAcoes button:has-text("Deixar como está")'); await page.waitForTimeout(2000);

const depoisDeIgnorar = await abrirTransferencias();
conferir('5. deixado como está, ele CONTINUA na aba — só muda o recado',
  /parecem transferência/.test(depoisDeIgnorar) &&
  /deixar como está/.test(depoisDeIgnorar), depoisDeIgnorar.slice(0, 220));
await page.screenshot({ path: dir+'/z26-par-ignorado-continua.png', fullPage: true });

// ---- e juntar funciona daqui ----
await page.click('#telaTransacoes .linha:has-text("Banco Inter → C6 Bank")'); await page.waitForTimeout(1200);
conferir('6. e o ignorado pode voltar a ser sugerido',
  /Voltar a sugerir/.test(limpo(await page.textContent('#dialogoAcoes').catch(() => ''))),
  limpo(await page.textContent('#dialogoAcoes').catch(() => '')));
await page.click('#dialogoAcoes button:has-text("Juntar")'); await page.waitForTimeout(2500);

const juntada = await abrirTransferencias();
console.log('depois de juntar:', juntada.slice(0, 260));
conferir('7. juntando, vira uma transferência de verdade na lista (uma linha só, com desfazer)',
  /1 juntada\(s\)/.test(juntada) && /Banco Inter → C6 Bank.*juntada.*desfazer ›/.test(juntada) && !/parecem transferência/.test(juntada),
  juntada.slice(0, 200));
await page.screenshot({ path: dir+'/z27-juntada.png', fullPage: true });

// ---- 17/11/2026: tocar na juntada e desfazer ----
await page.click('#telaTransacoes .transf-linha:has-text("Banco Inter → C6 Bank")'); await page.waitForTimeout(1000);
const dlg = limpo(await page.textContent('#dialogoFundo'));
conferir('8. tocando na juntada, oferece desfazer mostrando os dois lados', /Desfazer esta transferência\?/.test(dlg) &&
  /Saiu .*Banco Inter.*Pix enviado/.test(dlg) && /Entrou .*C6 Bank.*Pix recebido/.test(dlg), dlg.slice(0, 260));
await page.screenshot({ path: dir+'/z87-desfazer-transf.png' });
await page.click('#dialogoAcoes button:has-text("Desfazer")'); await page.waitForTimeout(2000);
const desfeita = limpo(await page.textContent('#telaTransacoes'));
conferir('9. desfeita, os dois voltam a ser saída e entrada e o par fica na lista para juntar depois',
  !/juntada\(s\)/.test(desfeita) && /Banco Inter → C6 Bank.*você mandou deixar como está/.test(desfeita), desfeita.slice(0, 260));
await page.click('#telaTransacoes button:has-text("Receitas")'); await page.waitForTimeout(800);
conferir('10. a entrada voltou para as receitas', /Pix recebido/.test(limpo(await page.textContent('#telaTransacoes'))));

// ---- um segundo par; a folha de juntar mostra o deixado de lado, desmarcado ----
await lancar('saida', 'Pix para mim', '20000', 'C6 Bank');
await lancar('entrada', 'Pix de mim', '20000', 'Banco Inter');
await page.waitForTimeout(2000);
await irParaInicio();
await page.click('#telaInicio .ver-transferencias'); await page.waitForTimeout(1200);
const fl = limpo(await page.textContent('#folha'));
const caixas = await page.$$eval('#folha .item-extrato', ns => ns.map(n => (n.querySelector('.caixinha.marcada') ? 'X' : '_') + (n.textContent.includes('deixou como está') ? 'ign' : 'novo')));
const abertaNaPrimeira = await page.locator('#folha .dica-i-balao:not(.fechado)').count();
conferir('11. na folha, o novo vem marcado e o deixado de lado aparece desmarcado; a dica abre sozinha na primeira vez',
  caixas.join(',') === 'Xnovo,_ign' && abertaNaPrimeira === 1 && /Juntou errado\? Em Transações › Transferências, toque nela e desfaça/.test(fl),
  caixas.join(',') + ' | ' + abertaNaPrimeira + ' | ' + fl.slice(0, 200));
await page.screenshot({ path: dir+'/z88-folha-transf.png' });
await page.waitForTimeout(6500);
const fechou = await page.locator('#folha .dica-i-balao.fechado').count();
await page.screenshot({ path: dir+'/z93-dica-recolhida.png' });
await page.click('#folha .dica-i-botao'); await page.waitForTimeout(900);
const reabriu = await page.locator('#folha .dica-i-balao:not(.fechado)').count();
conferir('11b. depois de uns segundos a dica encolhe até o "i", e tocar no "i" abre de novo', fechou === 1 && reabriu === 1, fechou + ' / ' + reabriu);
await page.click('#folha .dica-i-botao'); await page.waitForTimeout(900);
await page.goBack(); await page.waitForTimeout(800);

// ---- seleção: todas, juntar; só as juntadas, desfazer ----
await abrirTransferencias();
await page.click('#telaTransacoes .botao-selecionar-transf'); await page.waitForTimeout(600);
await page.click('#telaTransacoes .transf-acoes button:has-text("Selecionar todas")'); await page.waitForTimeout(600);
await page.screenshot({ path: dir+'/z89-selecao-transf.png' });
await page.click('#telaTransacoes .transf-rodape button:has-text("Juntar 2")'); await page.waitForTimeout(700);
await page.click('#dialogoAcoes button:has-text("Juntar")'); await page.waitForTimeout(2000);
const duas = limpo(await page.textContent('#telaTransacoes'));
conferir('12. selecionando todas, junta as duas de uma vez', /2 juntada\(s\)/.test(duas), duas.slice(0, 200));
await page.click('#telaTransacoes .botao-selecionar-transf'); await page.waitForTimeout(600);
await page.click('#telaTransacoes .transf-acoes button:has-text("Só as juntadas")'); await page.waitForTimeout(600);
await page.click('#telaTransacoes .transf-rodape button:has-text("Desfazer 2")'); await page.waitForTimeout(700);
await page.click('#dialogoAcoes button:has-text("Desfazer")'); await page.waitForTimeout(2000);
const nenhuma = limpo(await page.textContent('#telaTransacoes'));
conferir('13. e desfaz as duas de uma vez', !/juntada\(s\)/.test(nenhuma) && (nenhuma.match(/você mandou deixar como está/g) || []).length === 2, nenhuma.slice(0, 260));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: as transferências achadas aparecem onde a pessoa procura por elas');

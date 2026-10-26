// Conferir o dia sem sair da conferência, e apagar o duplicado ali mesmo.
//
// Pedido do Vitor em 26/10/2026, com dois prints lado a lado: a etiqueta
// "já existe" diz que achei um igual, mas não diz QUAL. Para conferir com
// os olhos ele tinha de sair da conferência, ir em Transações, achar o
// dia e voltar — e voltando o arquivo lido já tinha ido embora.
//
// Agora o dia abre embaixo da linha: o que a conta já tem naquela data, o
// que casa com a linha marcado, e o saldo no fim do dia. E se o duplicado
// estiver ali, o ✕ tira na hora — de verdade, não só da tela.
//
// E na mesma leva: "Baixar" deixou de nascer escondido, e ganhou
// "Relançar" do lado.
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

// Um extrato meu, com datas e valores que eu escolho: a conferência de um
// duplicado só vale se eu souber exatamente o que tem que casar.
const arquivo = dir + '/t131-extrato-' + process.pid + '.csv';
fs.writeFileSync(arquivo,
  'Data;Descrição;Valor\r\n' +
  '28/08/2026;PAG BOLETO GUSTAVO;-700,00\r\n' +
  '29/08/2026;PIX TRANSF VITOR;541,40\r\n' +
  '01/09/2026;JUROS LIMITE DA CONTA;-188,17\r\n', 'utf8');

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t131-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(600);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1200);

async function importar() {
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
  await page.click('#telaMais .linha:has-text("Importar extrato")'); await page.waitForTimeout(3500);
}
page.on('filechooser', async (fc) => { await fc.setFiles(arquivo); });

// ---- primeira importação: entra tudo ----
await importar();
const lidos = await page.locator('#folha .item-extrato').count();
conferir('1. o extrato foi lido com 3 linhas', lidos === 3, lidos + ' linha(s)');
await page.click('#folha .btn-ouro:has-text("Importar")'); await page.waitForTimeout(1500);
// O primeiro botão é o que confirma. semDialogo() clica no último, que
// aqui é "Cancelar" — e a importação não acontecia.
if (await page.locator('#dialogoFundo.aberta').count()) {
  console.log('confirmação:', limpo(await page.textContent('#dialogoTitulo').catch(() => '')));
  await page.locator('#dialogoAcoes button').nth(0).click();
}
await page.waitForTimeout(4000);
await semDialogo();

// ---- segunda importação do mesmo arquivo: tudo vira "já existe" ----
await importar();
const jaExiste = await page.locator('#folha .ja-tem').count();
conferir('2. reimportando, as 3 linhas vêm marcadas como "já existe"',
  jaExiste === 3, jaExiste + ' marcada(s)');
await page.screenshot({ path: dir+'/z01-conferencia-repetida.png', fullPage: true });

// ---- o dia abre embaixo da linha ----
const botoesDia = page.locator('#folha .etiqueta-dia');
conferir('3. cada linha tem o botão de abrir o dia',
  (await botoesDia.count()) === 3, (await botoesDia.count()) + ' botão(ões)');
await botoesDia.nth(0).click(); await page.waitForTimeout(900);
const painel = page.locator('#folha .dia-real');
const noPainel = limpo(await painel.first().textContent().catch(() => ''));
console.log('painel:', noPainel.slice(0, 200));
conferir('4. o painel mostra o dia da conta com o lançamento que já existe',
  (await painel.count()) === 1 &&
  /O que a conta já tem em 28\/08\/2026/.test(noPainel) &&
  /PAG BOLETO GUSTAVO/.test(noPainel), noPainel.slice(0, 120));
conferir('5. e aponta qual deles é igual a esta linha',
  /igual a esta linha/.test(noPainel) && (await page.locator('#folha .dia-igual').count()) === 1,
  (await page.locator('#folha .dia-igual').count()) + ' em ouro');
conferir('6. com o saldo da conta no fim do dia',
  /Saldo no fim do dia/.test(noPainel),
  (noPainel.match(/Saldo no fim do dia[^·]*/) || ['(não achei)'])[0]);
await page.screenshot({ path: dir+'/z02-dia-aberto.png', fullPage: true });

// ---- um dia de cada vez ----
await botoesDia.nth(1).click(); await page.waitForTimeout(900);
const abertos = await painel.count();
const segundo = limpo(await painel.first().textContent().catch(() => ''));
conferir('7. abrindo outro, o primeiro fecha: um dia de cada vez',
  abertos === 1 && /29\/08\/2026/.test(segundo), abertos + ' painel(éis) · ' + segundo.slice(0, 60));

// ---- o ✕ apaga o duplicado de verdade ----
await botoesDia.nth(0).click(); await page.waitForTimeout(900);
await page.click('#folha .dia-real .dia-tirar'); await page.waitForTimeout(900);
const perguntou = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
conferir('8. o ✕ pergunta antes de apagar', /Excluir este lançamento/.test(perguntou), perguntou);
await page.click('#dialogoAcoes button:has-text("Excluir")'); await page.waitForTimeout(3000);
await semDialogo();

const sobrou = await page.locator('#folha .ja-tem').count();
conferir('9. apagado o duplicado, a linha deixa de ser "já existe"',
  sobrou === 2, sobrou + ' marcada(s), era 3');
const marcadas = await page.locator('#folha .caixinha.marcada').count();
conferir('10. e ela volta marcada para lançar, já que não tem mais igual',
  marcadas === 1, marcadas + ' marcada(s)');
await page.screenshot({ path: dir+'/z03-duplicado-apagado.png', fullPage: true });

// Apagou de verdade? O painel segue aberto e tem que ter ficado vazio na
// hora — é o que a pessoa olha logo depois de tocar no ✕.
const vazio = limpo(await page.locator('#folha .dia-real').first().textContent().catch(() => ''));
conferir('11. o dia fica vazio na hora: saiu do estado mesmo',
  /Nada lançado nesse dia nessa conta/.test(vazio), vazio.slice(0, 110));

// ---- Baixar e Relançar aparecem nos extratos importados ----
await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
await semDialogo();
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(900);
await page.click('#telaInicio .cartao:has-text("Contas") .linha:has-text("Inter")');
await page.waitForTimeout(1500);
await page.click('#folha .btn-ouro:has-text("Conferir esta conta")'); await page.waitForTimeout(3500);
const temBaixar = await page.locator('#folha button:has-text("Baixar"):visible').count();
const temRelancar = await page.locator('#folha button:has-text("Relançar"):visible').count();
conferir('12. a leva importada oferece Baixar e Relançar',
  temBaixar === 1 && temRelancar === 1, temBaixar + ' Baixar · ' + temRelancar + ' Relançar');
const ligado = await page.locator('#folha button:has-text("Relançar"):not([disabled])').count();
conferir('13. e eles ligam quando o arquivo está guardado na nuvem',
  ligado === 1, ligado + ' ligado(s)');
await page.screenshot({ path: dir+'/z04-baixar-relancar.png', fullPage: true });

// ---- relançar lê o arquivo guardado e reabre a conferência ----
await page.click('#folha button:has-text("Relançar")'); await page.waitForTimeout(7000);
const titulo = limpo(await page.textContent('#folhaTitulo').catch(() => ''));
const relidos = await page.locator('#folha .item-extrato').count();
conferir('14. Relançar reabre a conferência com as 3 linhas do arquivo',
  /Conferir o extrato/.test(titulo) && relidos === 3, titulo + ' · ' + relidos + ' linha(s)');
await page.screenshot({ path: dir+'/z05-relancado.png', fullPage: true });

// ---- "e isso ficar salvo": o apagado tem que sumir do servidor também ----
//
// Sumir da tela é fácil. O que ele pediu é que não volte — e voltar é
// exatamente o que acontece quando a exclusão fica só no aparelho e a
// sincronização seguinte baixa a linha de novo lá de cima.
await page.keyboard.press('Escape'); await page.waitForTimeout(1200);
await semDialogo();
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Sincronizar agora")'); await page.waitForTimeout(9000);
await semDialogo();
const vivoNoServidor = await page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl +
    '/rest/v1/lancamentos?select=id,valor,excluido_em&valor=eq.70000',
    { headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
  const linhas = await r.json();
  return linhas.filter((l) => !l.excluido_em).length;
});
conferir('15. depois de sincronizar, o apagado não existe mais no servidor',
  vivoNoServidor === 0, vivoNoServidor + ' vivo(s) de R$ 700,00');

// E recarregando o app ele não volta.
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(9000);
await semDialogo();
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1500);
await page.click('#telaTransacoes :text("Último ano")'); await page.waitForTimeout(1500);
const transacoes = limpo(await page.textContent('#telaTransacoes').catch(() => ''));
conferir('16. e recarregando o app ele não volta',
  !/GUSTAVO/.test(transacoes) && /VITOR/.test(transacoes),
  transacoes.slice(0, 120));
await page.screenshot({ path: dir+'/z06-nao-voltou.png', fullPage: true });

await browser.close();
try { fs.unlinkSync(arquivo); } catch (e) { /* já foi */ }
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: o dia na conferência, o ✕ que apaga, e Baixar/Relançar');

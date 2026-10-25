// O histórico do saldo: de onde veio cada mudança.
//
// Pedido do Vitor em 25/10/2026: "um histórico de atualização toda vez que
// muda do saldo, entender de onde veio essa atualização do saldo".
//
// Nasceu de um lançamento que ele criou, viu sumir, recriou e viu sumir de
// novo. Sem registro não dá para separar três causas que pedem reações
// diferentes: a nuvem trouxe outra versão, eu mesmo apaguei, ou voltei a
// uma cópia.
//
// E a volta a uma cópia passou a avisar na hora que terminou, em vez de um
// toque que some em dois segundos enquanto o app parece parado.
import { chromium, dir, ENDERECO } from '../comum.mjs';
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
const abrirHistorico = async () => {
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
  await page.click('#telaMais .linha:has-text("Histórico do saldo")'); await page.waitForTimeout(1500);
  return limpo(await page.textContent('#folha'));
};
const fecharTudo = async () => {
  for (let i = 0; i < 6; i++) {
    if (await page.locator('#dialogoFundo.aberta').count()) {
      const bs = page.locator('#dialogoAcoes button');
      await bs.nth((await bs.count()) - 1).click({ force: true }).catch(() => {});
      await page.waitForTimeout(800); continue;
    }
    if (await page.locator('#folha.aberta').count()) {
      await page.click('#cortina', { force: true }).catch(() => {});
      await page.waitForTimeout(800); continue;
    }
    break;
  }
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t126-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await irParaInicio();
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1500);
await irParaInicio();
await page.click('#fab'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '32000');
await folha().locator('input.entrada[type=text]').first().fill('Aluguel');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(5000);

const comMexida = await abrirHistorico();
console.log('histórico:', comMexida.slice(0, 260));
conferir('1. a mexida da pessoa está anotada',
  /Você mexeu no app/.test(comMexida), comMexida.slice(0, 160));
conferir('2. com o total depois dela', /R\$ 320,00/.test(comMexida), comMexida.slice(0, 200));
await page.screenshot({ path: dir+'/z21-historico.png', fullPage: true });
await fecharTudo();

// A cópia à mão, para ter para onde voltar.
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
await page.click('#folha button:has-text("Guardar uma cópia agora")'); await page.waitForTimeout(7000);
await fecharTudo();

// Mais um lançamento, que a volta vai desfazer.
await irParaInicio();
await page.click('#fab'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '18000');
await folha().locator('input.entrada[type=text]').first().fill('Luz');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(5000);

// ---- a volta, com aviso na hora ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
await page.click('#folha .linha:has-text("Cópia feita por você")'); await page.waitForTimeout(1200);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(400);
const esperando = await page.evaluate(() => ({
  titulo: (document.getElementById('dialogoTitulo') || {}).textContent || '',
  rodinha: !!document.querySelector('#dialogoAcoes .dialogo-espera'),
  botoes: document.querySelectorAll('#dialogoAcoes button').length
}));
conferir('3. enquanto volta, mostra a espera em vez de deixar o app parado',
  /Voltando a esta cópia/.test(esperando.titulo) && esperando.rodinha && esperando.botoes === 0,
  JSON.stringify(esperando));
await page.screenshot({ path: dir+'/z22-voltando.png' });

await page.waitForSelector('#dialogoTitulo:text-is("Pronto, voltou")', { timeout: 40000 })
  .catch(() => {});
const fim = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
conferir('4. e avisa assim que termina', /Pronto, voltou/.test(fim), fim);
await page.screenshot({ path: dir+'/z23-voltou.png' });
await fecharTudo();

// ---- e a volta ficou anotada no histórico ----
const depois = await abrirHistorico();
console.log('histórico depois:', depois.slice(0, 300));
conferir('5. a volta no tempo está anotada, e não como mexida sua',
  /Você voltou para a cópia de/.test(depois), depois.slice(0, 200));
conferir('6. o histórico não se perdeu junto com a volta',
  /Você mexeu no app/.test(depois), depois.slice(0, 260));
await page.screenshot({ path: dir+'/z24-historico-com-volta.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: o histórico explica de onde veio cada mudança, e a volta avisa na hora');

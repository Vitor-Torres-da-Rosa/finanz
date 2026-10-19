// Desmarcar "lançar como entrada no caixa" tira o lançamento do extrato.
//
// O lançamento só existe porque alguém marcou essa caixinha ao registrar
// o pagamento do cliente. Mas a caixinha só aparecia ao CRIAR: editando o
// pagamento ela sumia. O que entrou no extrato por engano ficava lá,
// somando no saldo para sempre, sem nenhuma tela capaz de desligar.
//
// Pedido do Vitor em 19/10/2026: desmarcar tem de sumir do extrato e
// manter o registro no Empreendedor, que é onde o pagamento sempre foi o
// registro de verdade.
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
const folhaFechou = () => page.waitForFunction(
  () => !document.getElementById('folha').classList.contains('aberta'), null, { timeout: 20000 });
// Campo de dinheiro é mascarado: fill() acrescenta em vez de trocar.
const porDinheiro = async (loc, digitos) => {
  await loc.click();
  for (let i = 0; i < 16; i++) await loc.press('Backspace');
  await loc.type(digitos);
  await page.waitForTimeout(300);
};
// Depois de salvar pode sobrar um diálogo ou a própria folha aberta, e
// qualquer um dos dois intercepta o clique na barra de navegação.
const limparTela = async () => {
  for (let i = 0; i < 4; i++) {
    const temDialogo = await page.evaluate(() => {
      const d = document.getElementById('dialogoFundo');
      return !!(d && !d.hidden);
    });
    if (temDialogo) {
      await page.click('#dialogoAcoes button >> nth=0').catch(() => {});
      await page.waitForTimeout(900);
      continue;
    }
    const folhaAberta = await page.evaluate(() =>
      document.getElementById('folha').classList.contains('aberta'));
    if (!folhaAberta) return;
    await page.evaluate(() => { history.back(); });
    await page.waitForTimeout(900);
  }
};

const caixinha = () => page.evaluate(() => {
  const b = Array.from(document.querySelectorAll('#folha .lembrar'))
    .find((x) => /entrada no caixa/i.test(x.textContent || ''));
  return b ? b.getAttribute('aria-pressed') : 'ausente';
});

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t103-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// conta
await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(700);
await folha().locator('input.entrada[type=text]').first().fill('C6 Bank');
await page.click('#folha .btn-ouro'); await folhaFechou(); await page.waitForTimeout(900);

// cliente + registro
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#fab'); await page.waitForTimeout(800);
await folha().locator('input.entrada[type=text]').nth(0).fill('Fabi do juliano');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1000);
await page.click('#telaInicio .linha-alvo:has-text("Fabi do juliano")'); await page.waitForTimeout(900);
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '33750');
await folha().locator('input.entrada[type=text]').nth(0).fill('Celular');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1600);
// O diálogo oferece combinar parcelas; aqui não quero parcelar, só pagar.
const bots = await page.$$eval('#dialogoAcoes button', ns => ns.map((x) => x.textContent.trim()));
const iFechar = bots.findIndex((b) => /agora não|depois|cancelar|fechar/i.test(b));
await page.click('#dialogoAcoes button >> nth=' + (iFechar >= 0 ? iFechar : bots.length - 1));
await page.waitForTimeout(1600);

// --- registra o pagamento ---
await page.click('#folha button:has-text("Pagos")'); await page.waitForTimeout(900);
await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(1100);
conferir('1. a caixinha nasce DESMARCADA no pagamento novo',
  (await caixinha()) === 'false', 'aria-pressed=' + await caixinha());

// O valor nasce vazio de propósito (pagamento parcial é comum); o
// atalho "Tudo" preenche com o que falta.
await page.click('#folha button:has-text("Tudo:")'); await page.waitForTimeout(700);
await page.click('#folha .lembrar:has-text("entrada no caixa")'); await page.waitForTimeout(700);
conferir('2. e dá para marcar', (await caixinha()) === 'true');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2800);
await limparTela();

await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1800);
const comLanc = limpo(await page.textContent('#telaTransacoes'));
console.log('extrato com:', comLanc.slice(0, 170));
conferir('3. marcada, a entrada aparece no extrato',
  /Fabi do juliano/.test(comLanc) && /337,50/.test(comLanc), comLanc.slice(0, 120));

// --- volta no pagamento e DESMARCA ---
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#telaInicio .linha-alvo:has-text("Fabi do juliano")'); await page.waitForTimeout(1100);
await page.click('#folha button:has-text("Pagos")'); await page.waitForTimeout(900);
await page.click('#folha .linha >> nth=0'); await page.waitForTimeout(1200);

conferir('4. editando, a caixinha existe e está MARCADA',
  (await caixinha()) === 'true', 'aria-pressed=' + await caixinha());

await page.click('#folha .lembrar:has-text("entrada no caixa")'); await page.waitForTimeout(700);
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2800);
await limparTela();

// --- sumiu do extrato ---
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1800);
const semLanc = limpo(await page.textContent('#telaTransacoes'));
console.log('extrato sem:', semLanc.slice(0, 170));
conferir('5. desmarcada, a entrada SAI do extrato',
  !/Fabi do juliano/.test(semLanc), semLanc.slice(0, 120));
await page.screenshot({ path: dir+'/n01-saiu-do-extrato.png', fullPage: true });

// --- mas o pagamento continua no Empreendedor ---
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#telaInicio .linha-alvo:has-text("Fabi do juliano")'); await page.waitForTimeout(1100);
await page.click('#folha button:has-text("Pagos")'); await page.waitForTimeout(900);
const ficha = limpo(await page.textContent('#folha'));
console.log('pagos:', ficha.slice(0, 190));
conferir('6. e o pagamento continua registrado no Empreendedor',
  /337,50/.test(ficha), ficha.slice(0, 120));
await page.screenshot({ path: dir+'/n02-registro-fica.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: desmarcar tira do extrato e mantém o registro');

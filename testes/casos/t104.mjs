// Abrir uma parcela paga tem de mostrar as DUAS datas.
//
// Pedido do Vitor em 20/10/2026: clicando numa parcela paga, ver a data
// do pagamento e também o vencimento dela. A folha mostrava quando o
// dinheiro entrou (o campo "Data do pagamento") mas em nenhum lugar
// quando ele deveria ter entrado — e é a diferença entre as duas que
// diz se o cliente paga em dia.
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
// Depois de salvar sobra folha ou diálogo aberto, e qualquer um bloqueia
// o clique nas telas de baixo.
const limparTela = async () => {
  for (let i = 0; i < 5; i++) {
    const temDialogo = await page.evaluate(() => {
      const d = document.getElementById('dialogoFundo');
      return !!(d && !d.hidden);
    });
    if (temDialogo) {
      await page.click('#dialogoAcoes button >> nth=0').catch(() => {});
      await page.waitForTimeout(900); continue;
    }
    const aberta = await page.evaluate(() =>
      document.getElementById('folha').classList.contains('aberta'));
    if (!aberta) return;
    await page.evaluate(() => { history.back(); });
    await page.waitForTimeout(900);
  }
};

const escolher = async (r) => {
  await page.click(`#escolhaLista .escolha-item:has-text("${r}")`);
  await page.waitForTimeout(700);
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t104-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// cliente + registro parcelado
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#fab'); await page.waitForTimeout(800);
await folha().locator('input.entrada[type=text]').nth(0).fill('Edison e Sander');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1100);
await page.click('#telaInicio .linha-alvo:has-text("Edison e Sander")'); await page.waitForTimeout(1000);
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '45000');
await folha().locator('input.entrada[type=text]').nth(0).fill('Venda de celular');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
await page.click('#dialogoAcoes button:has-text("Combinar parcelas")'); await page.waitForTimeout(1500);
await page.click('#folha .campo:has-text("Em quantas vezes") .selecao'); await page.waitForTimeout(700);
await escolher('3x');
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(1000);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(2200);

// paga a parcela 1
await page.click('#folha button:has-text("Pagos")'); await page.waitForTimeout(900);
await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(1200);
// Igual ao t61: o primeiro seletor da folha é o da parcela.
await page.click('#folha .selecao >> nth=0'); await page.waitForTimeout(700);
await escolher('Parcela 1 de 3');
await porDinheiro(folha().locator('.valor-grande'), '15000');

const antesDeSalvar = limpo(await page.textContent('#folha'));
console.log('folha do pagamento:', antesDeSalvar.slice(0, 300));
conferir('1. a folha mostra o vencimento da parcela',
  /Vence em/.test(antesDeSalvar), antesDeSalvar.slice(0, 150));
conferir('2. e diz a relação entre pagamento e vencimento',
  /Pago .*vencimento|Pago no dia do vencimento/.test(antesDeSalvar),
  (antesDeSalvar.match(/Pago[^.]*\./) || ['(não achei)'])[0]);
await page.screenshot({ path: dir+'/o01-duas-datas.png', fullPage: true });

// --- e agora a tela que o Vitor realmente abre: EDITAR o pagamento ---
//
// Clicar numa parcela JÁ PAGA não abre "Registrar pagamento", abre
// "Editar pagamento". Na primeira tentativa eu testei só a de registrar
// e o conserto não chegava nesta — o cartão da parcela nem era criado
// quando havia pagamento existente.
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2800);
await limparTela();

// Reabre o cliente pelo caminho normal: o back fecha a folha inteira.
await page.click('#navegacao button:has-text("Início")').catch(() => {});
await page.waitForTimeout(1200);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")').catch(() => {});
await page.waitForTimeout(1100);
await page.click('#telaInicio .linha-alvo:has-text("Edison e Sander")'); await page.waitForTimeout(1500);
await page.click('#folha button:has-text("Parcelas")'); await page.waitForTimeout(1200);
// O cabeçalho fixo da folha tapa a linha; centralizo antes de clicar.
await page.evaluate(() => {
  const l = Array.from(document.querySelectorAll('#folha .linha'))
    .find((x) => /Parcela 1 de 3/.test(x.textContent || ''));
  if (l) l.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(600);
await page.click('#folha .linha:has-text("Parcela 1 de 3")'); await page.waitForTimeout(1800);

const naEdicao = limpo(await page.textContent('#folha'));
console.log('EDITAR:', naEdicao.slice(0, 300));
conferir('3. a tela de EDITAR é a que abre numa parcela paga',
  /Editar pagamento/.test(naEdicao), naEdicao.slice(0, 80));
conferir('4. e ela mostra o vencimento',
  /Vence em/.test(naEdicao), naEdicao.slice(0, 150));
conferir('5. e a data do pagamento',
  /Pago em/.test(naEdicao), naEdicao.slice(0, 150));
conferir('6. e a relação entre as duas',
  /Pago .*vencimento/.test(naEdicao),
  (naEdicao.match(/Pago[^.]*vencimento\./) || ['(não achei)'])[0]);
await page.screenshot({ path: dir+'/o02-editar-duas-datas.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: as duas datas aparecem na parcela');

// Parcelamento com acréscimo: pagar não pode encolher nem apagar a última.
//
// O caminho do "sumiu 1 parcela" que o Vitor mandou em 02/11/2026: o
// registro de R$ 1.000,00 parcelado em 4x com R$ 100,00 por parcela vira
// 4x de R$ 325,00. A conta que reencaixa o combinado depois de cada
// pagamento só via os R$ 1.000,00 do registro e esquecia o acréscimo:
// pagar a 1ª deixava a 4ª em R$ 25,00, e lá pela 3ª a 4ª era apagada —
// "Parcela 3 de 3" com o cliente tendo pago as quatro.
import { chromium, dir, ENDERECO, irParaClientes } from '../comum.mjs';
import { abrirHistorico } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const linhas = () => page.$$eval('#folha .cartao .linha', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t145-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await irParaClientes(page);
await page.click('#fab'); await page.waitForTimeout(800);
await page.locator('#folha input.entrada[type=text]').first().fill('Fabi do juliano');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .linha-alvo:has-text("Fabi do juliano")'); await page.waitForTimeout(900);
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(1000);
await page.locator('#folha .campo:has-text("Valor combinado") input').fill('100000');
await page.locator('#folha input.entrada[type=text]').first().fill('Celular');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
await page.click('#dialogoAcoes button:has-text("Combinar parcelas")'); await page.waitForTimeout(1400);
await page.click('#folha .campo:has-text("Acréscimo") .selecao'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Acrescentar R$ por parcela")'); await page.waitForTimeout(800);
await page.locator('#folha .campo:has-text("Quantos reais por parcela") input').fill('10000');
await page.click('#folha .campo:has-text("Em quantas vezes") .selecao'); await page.waitForTimeout(600);
await page.click('#escolhaLista .escolha-item:has-text("4x")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(1800);

const pagarParcela = async (n) => {
  await page.click(`#folha .linha:has-text("Parcela ${n} de 4")`); await page.waitForTimeout(800);
  await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(1100);
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);
};

await pagarParcela(1);
let ls = await linhas();
conferir('1. paga a 1ª, a 4ª continua em R$ 325,00', ls.length === 4 && /Parcela 4 de 4.*R\$ 325,00/.test(ls[3]), ls[3]);
conferir('2. e não aparece desencontro para acertar',
  !(await page.locator('#folha .acoes button:has-text("Acertar as parcelas")').count()));

await pagarParcela(2);
await pagarParcela(3);
ls = await linhas();
conferir('3. pagas três, a 4ª continua lá, inteira',
  ls.length === 4 && /^4Parcela 4 de 4.*R\$ 325,00/.test(ls[3]), JSON.stringify(ls));

// A última pela aba Pagos, com o único registro: a parcela já vem marcada.
await abrirHistorico(page); await page.waitForTimeout(800);
await page.click('#folha button:has-text("+ Registrar pagamento")'); await page.waitForTimeout(1100);
const equivale = limpo(await page.textContent('#folha .parcela-linha:has-text("Equivale a")'));
conferir('4. pela aba Pagos, a parcela 4 já vem escolhida com o valor dela',
  /Parcela 4 de 4/.test(equivale) && /325,00/.test(await page.locator('#folha .valor-grande').inputValue()), equivale);
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);

await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(800);
const tela = limpo(await page.textContent('#folha .cartao.liso'));
conferir('5. as quatro pagas, e o registro foi para Finalizados',
  /Celular · 4 de 4 paga\(s\) · quitado/.test(tela) && (tela.match(/✓Parcela \d de 4/g) || []).length === 4, tela.slice(0, 160));
const resumo = limpo(await page.textContent('#folha'));
conferir('6. o cliente fecha em R$ 1.300,00 pagos e nada faltando',
  /PAGO\s*R\$ 1\.300,00/i.test(resumo) && /FALTA\s*R\$ 0,00/i.test(resumo), (resumo.match(/TOTAL.{0,80}/i) || [''])[0]);
await page.screenshot({ path: dir + '/z36-acrescimo-quitado.png', fullPage: true });

// ---- recarregar não pode perder de quem é o acréscimo ----
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3000);
await irParaClientes(page);
await page.click('#telaInicio .linha-alvo:has-text("Fabi do juliano")'); await page.waitForTimeout(900);
const regs = limpo(await page.textContent('#folha'));
conferir('7. recarregando, o acréscimo continua dentro do registro',
  /com R\$ 300,00 de acréscimo/.test(regs) && !/Acréscimo do parcelamento em 4x/.test(regs));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: acréscimo não encolhe nem apaga parcela');

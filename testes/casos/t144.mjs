// Aba Parcelas: um registro por vez, Finalizados, e pagamento sem parcela.
//
// Pedidos do Vitor em 02/11/2026:
//  - "pode retirar a aba todas" e "apagar deveria apagar somente as
//    parcelas dessa venda ou serviço selecionado [...] inclusive as pagas
//    para excluir isso não deveria acontecer";
//  - "combinei as 4 parcelas e selecionei que o cliente pagou as 4 mas em
//    parcelas sumiu 1" — a ficha mostrava "Parcela 3 de 3" com quatro
//    pagamentos;
//  - "da pra deixar uma aba assim: finalizados", para onde vai sozinho o
//    registro com todas as parcelas pagas, e tocando no nome abrem as
//    parcelas e o histórico de pagamento.
import { chromium, dir, ENDERECO, irParaClientes } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const dinheiro = async (loc, digitos) => {
  await loc.click(); for (let i = 0; i < 14; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(200);
};
const linhas = () => page.$$eval('#folha .cartao .linha', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
const chips = () => page.$$eval('#folha .segmentos-grupos button', ns => ns.map(n => n.textContent.trim()));
const aba = async (nome) => { await page.click(`#folha .aba-cliente button:has-text("${nome}")`); await page.waitForTimeout(800); };
const chip = async (nome) => { await page.click(`#folha .segmentos-grupos button:has-text("${nome}")`); await page.waitForTimeout(800); };

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t144-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await irParaClientes(page);
await page.click('#telaInicio .cartao-acao:has-text("+ Novo")'); await page.waitForTimeout(800);
await folha().locator('input.entrada[type=text]').first().fill('Diego Schena');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .linha-alvo:has-text("Diego Schena")'); await page.waitForTimeout(900);

// Dois registros, cada um com o seu parcelamento.
const registroParcelado = async (nome, digitos, vezes) => {
  await page.click('#folha button:has-text("+ Nova venda ou serviço")'); await page.waitForTimeout(900);
  await dinheiro(folha().locator('.valor-grande'), digitos);
  await folha().locator('input[placeholder="Ex.: Troca de embreagem"]').fill(nome);
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);
  await page.click('#dialogoAcoes button:has-text("Combinar parcelas")'); await page.waitForTimeout(1300);
  await page.click('#folha .campo:has-text("Em quantas vezes") .selecao'); await page.waitForTimeout(600);
  await page.click(`#escolhaLista .escolha-item:has-text("${vezes}")`); await page.waitForTimeout(700);
  await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(900);
  await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(1600);
};
await registroParcelado('Venda de celular', '170000', '4x');
await aba('Registros');
await registroParcelado('Poco f5', '180000', '2x');

await aba('Parcelas');
let ch = await chips();
conferir('1. sem o botão "Todos": um botão por registro', !ch.includes('Todos') &&
  ch.includes('Venda de celular') && ch.includes('Poco f5') && ch.length === 2, JSON.stringify(ch));
await chip('Venda de celular');
let ls = await linhas();
conferir('2. a lista mostra só as parcelas do registro escolhido',
  ls.length === 4 && ls.every(t => /de 4/.test(t)), ls.length + ' linha(s)');

// ---- 1ª parcela pelo caminho de sempre: tocar na parcela ----
await page.click('#folha .linha:has-text("Parcela 1 de 4")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(1100);
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);

const botaoApagar = limpo(await page.textContent('#folha .acoes .btn-perigo').catch(() => ''));
conferir('3. apagar fala só das parcelas em aberto deste registro', botaoApagar === 'Apagar as 3 parcelas em aberto', botaoApagar);

// ---- 2ª pela aba Pagos: escolhendo o registro, a parcela acompanha ----
await aba('Parcelas');
await page.click('#folha button:has-text("+ Registrar pagamento")'); await page.waitForTimeout(1100);
await page.click('#folha .parcela-linha:has-text("Referente a") .selecao'); await page.waitForTimeout(600);
await page.click('#escolhaLista .escolha-item:has-text("Venda de celular")'); await page.waitForTimeout(700);
const equivale = limpo(await page.textContent('#folha .parcela-linha:has-text("Equivale a")'));
conferir('4. escolhendo o registro, a próxima parcela dele já vem marcada', /Parcela 2 de 4/.test(equivale), equivale);
conferir('5. e o valor dela já vem preenchido',
  /425,00/.test(await folha().locator('.valor-grande').inputValue()));
await page.screenshot({ path: dir + '/z33-pagamento-registro.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);

// ---- 3ª: "Sem parcela específica" de propósito ----
await page.click('#folha button:has-text("+ Registrar pagamento")'); await page.waitForTimeout(1100);
await page.click('#folha .parcela-linha:has-text("Referente a") .selecao'); await page.waitForTimeout(600);
await page.click('#escolhaLista .escolha-item:has-text("Venda de celular")'); await page.waitForTimeout(700);
await page.click('#folha .parcela-linha:has-text("Equivale a") .selecao'); await page.waitForTimeout(600);
await page.click('#escolhaLista .escolha-item:has-text("Sem parcela específica")'); await page.waitForTimeout(600);
await dinheiro(folha().locator('.valor-grande'), '42500');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);

await aba('Parcelas');
await chip('Venda de celular');
ls = await linhas();
conferir('6. o pagamento solto fechou a 3ª parcela em vez de apagar a última',
  ls.length === 4 && ls.filter(t => /^✓Parcela \d de 4Paga em/.test(t)).length === 3 && /Parcela 4 de 4Vence/.test(ls[3]),
  JSON.stringify(ls));

// ---- 4ª pela parcela: o registro é todo pago e vai para Finalizados ----
await page.click('#folha .linha:has-text("Parcela 4 de 4")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(1100);
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);
ch = await chips();
conferir('7. quitado, o registro sai dos botões e entra em Finalizados',
  !ch.includes('Venda de celular') && ch.includes('Poco f5') && ch.includes('Finalizados'), JSON.stringify(ch));
const sel = await page.$eval('#folha .segmentos-grupos button[aria-selected="true"]', b => b.textContent.trim()).catch(() => '');
const telaAgora = limpo(await page.textContent('#folha .cartao.liso'));
conferir('8. e a tela acompanha: Finalizados, com as 4 parcelas pagas à vista',
  sel === 'Finalizados' && /Venda de celular · 4 de 4 paga\(s\) · quitado/.test(telaAgora), sel + ' · ' + telaAgora.slice(0, 90));
await page.screenshot({ path: dir + '/z34-finalizado-aberto.png', fullPage: true });

await page.click('#folha .voltar-finalizados'); await page.waitForTimeout(700);
const listaF = limpo(await page.textContent('#folha .cartao.liso'));
conferir('9. a lista de Finalizados mostra o registro com as parcelas e o total',
  /Venda de celular\s*4x · quitado em/.test(listaF) && /R\$ 1\.700,00/.test(listaF), listaF.slice(0, 140));
await page.screenshot({ path: dir + '/z35-finalizados.png', fullPage: true });
conferir('10. em Finalizados não há botão de apagar', !(await page.locator('#folha .acoes .btn-perigo').count()));

await page.click('#folha .linha-finalizado:has-text("Venda de celular")'); await page.waitForTimeout(800);
const aberto = limpo(await page.textContent('#folha .cartao.liso'));
conferir('11. tocando no nome, abrem as parcelas e os pagamentos recebidos',
  (aberto.match(/✓Parcela \d de 4Paga/g) || []).length === 4 && /Pagamentos recebidos/.test(aberto) &&
  (aberto.match(/\+ R\$ 425,00/g) || []).length === 4, aberto.slice(0, 120));
await page.click('#folha .linha:has-text("Parcela 2 de 4")'); await page.waitForTimeout(1000);
conferir('12. a parcela paga abre o pagamento dela', /Editar pagamento/.test(limpo(await page.textContent('#folha'))));
await page.goBack(); await page.waitForTimeout(900);

// ---- apagar no outro registro não encosta nas pagas ----
await chip('Poco f5');
const rot = limpo(await page.textContent('#folha .acoes .btn-perigo'));
conferir('13. no Poco f5, apagar conta só as 2 dele', rot === 'Apagar as 2 parcelas', rot);
await page.click('#folha .acoes .btn-perigo'); await page.waitForTimeout(700);
await page.click('#dialogoAcoes button:has-text("Apagar tudo")'); await page.waitForTimeout(1500);
const resto = limpo(await page.textContent('#folha .cartao.liso'));
conferir('14. as parcelas pagas da venda de celular continuam lá',
  /Venda de celular/.test(resto) && !(await page.locator('#folha .segmentos-grupos').count()), resto.slice(0, 120));

// ---- apagar as em aberto de uma venda meio paga tem de durar ----
await aba('Registros');
await registroParcelado('Capinha', '10000', '2x');
await aba('Parcelas');
await page.click('#folha .linha:has-text("Parcela 1 de 2")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(1100);
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);
await page.click('#folha .acoes .btn-perigo:has-text("Apagar a parcela em aberto")'); await page.waitForTimeout(700);
await page.click('#dialogoAcoes button:has-text("Apagar as em aberto")'); await page.waitForTimeout(1400);
await aba('Registros');
await registroParcelado('Película', '6000', '2x');
await aba('Parcelas');
await page.click('#folha .linha:has-text("Parcela 1 de 2")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Registrar pagamento")'); await page.waitForTimeout(1100);
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1400);
ch = await chips();
conferir('15. pagar outra venda não refaz a parcela apagada da Capinha',
  !ch.includes('Capinha') && ch.includes('Película'), JSON.stringify(ch));
const semPlano = limpo(await page.textContent('#folha .cartao-sem-parcela').catch(() => ''));
conferir('15b. o que falta da Capinha aparece em "Sem parcelas combinadas"', /Capinha.*R\$ 50,00/.test(semPlano), semPlano.slice(0, 120));

// ---- 03/11/2026: sem a aba Pagos, e registro pago em verde no fim ----
const abasFicha = await page.$$eval('#folha .aba-cliente button', ns => ns.map(n => n.textContent.trim()));
conferir('16. a ficha não tem mais a aba Pagos', !abasFicha.includes('Pagos') && abasFicha.includes('Parcelas'), abasFicha.join('|'));
const toggle = page.locator('#folha .historico-toggle');
conferir('17. o histórico de pagamentos fica dentro de Parcelas, fechado',
  (await toggle.count()) === 1 && (await toggle.getAttribute('aria-expanded')) === 'false' &&
  !(await page.locator('#folha .linha-pagamento').count()));
await toggle.click(); await page.waitForTimeout(600);
conferir('18. abrindo, aparecem os pagamentos', (await page.locator('#folha .linha-pagamento').count()) >= 6,
  String(await page.locator('#folha .linha-pagamento').count()));
await aba('Registros');
const regs = await page.$$eval('#folha .cartao.liso .linha', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
conferir('19. a venda de celular, 100% paga, fica por último e marcada como paga',
  /^✓Venda de celular.*R\$ 1\.700,00pago$/.test(regs[regs.length - 1]) &&
  regs.filter(t => /pago$/.test(t)).length === 1, JSON.stringify(regs));
await page.screenshot({ path: dir + '/z43-registro-pago.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: aba Parcelas por registro e Finalizados');

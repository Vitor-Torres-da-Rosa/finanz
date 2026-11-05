// Uber: sem abastecer, é tudo lucro; e os cartões Faturamento, Despesas e
// Lucro abrem o detalhamento.
//
// Pedido do Vitor em 04/11/2026: no fechamento com "Abastecido hoje" R$ 0,00
// a linha "Combustível do Uber" some e o lucro é o ganho inteiro. E no
// histórico, tocar em Despesas, Faturamento ou Lucro mostra de onde vem.
import { chromium, dir, ENDERECO } from '../comum.mjs';
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
const tela = async () => limpo(await page.textContent('#telaInicio'));
const dinheiro = async (loc, digitos) => {
  await loc.click(); for (let i = 0; i < 12; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(150);
};

// 04/11/2026 às 15h: ontem é do mesmo mês.
await page.clock.setFixedTime(new Date(2026, 10, 4, 15, 0, 0));

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t156-' + Math.random().toString(36).slice(2) + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Ontem: abasteceu R$ 100,00 e rodou 57,3 km a 8,3 km/l com o litro a
// R$ 5,85 → R$ 40,39 do Uber. E uma lavagem de R$ 15,00.
await page.evaluate(() => new Promise(res => {
  const s = Math.random().toString(36).slice(2);
  const dados = { contas: [{ id: 'cc-t156-' + s, nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 }],
                  lancamentos: [],
                  uberRegistros: [
                    { id: 'd-t156-' + s, tipo: 'dia', data: '2026-11-03', hora: '22:00', valor: 7360, km: 57.3, viagens: 4,
                      minutos: 130, kmPorLitro: 8.3, precoLitro: 585, abastecido: 10000, plataforma: 'Uber', criadoEm: 1 },
                    { id: 'x-t156-' + s, tipo: 'despesa', data: '2026-11-03', valor: 1500, categoria: 'Lavagem', criadoEm: 2 }
                  ] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(900);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#telaInicio [data-modulo="uber"]'); await page.waitForTimeout(900);

// ---- hoje: rodou sem abastecer ----
await page.click('#fab'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Novo registro")'); await page.waitForTimeout(900);
await dinheiro(folha().locator('.valor-grande'), '7659');
await folha().locator('.contador-campo').fill('6');
await folha().getByLabel('Tempo online (horas:minutos)').fill('201');
await folha().getByLabel('Km rodados').fill('431');
const prev = limpo(await folha().locator('.fechamento-resumo').textContent());
conferir('1. sem abastecer, não aparece "Combustível do Uber"', !/Combustível/.test(prev), prev);
conferir('2. e o lucro do dia é o ganho inteiro', /Lucro do dia\s*R\$ 76,59/.test(prev), prev);
await page.screenshot({ path: dir + '/z58-sem-abastecer.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar registro")'); await page.waitForTimeout(1200);
const hoje = await tela();
conferir('3. o Hoje fica sem gasto', /Gastos\s*R\$ 0,00/.test(hoje) && /Lucro líquido\s*R\$ 76,59/.test(hoje), hoje.slice(0, 300));

// ---- histórico: os três cartões abrem o detalhamento ----
await page.click('#telaInicio .abas-modulo button:has-text("Histórico")'); await page.waitForTimeout(800);
const hist = await tela();
// 76,59 + 73,60 = 150,19; despesas 40,39 + 15,00 = 55,39; lucro 94,80.
conferir('4. o histórico soma certo', /Faturamento\s*R\$ 150,19/.test(hist) && /Despesas\s*R\$ 55,39/.test(hist) &&
  /Lucro\s*R\$ 94,80/.test(hist), hist.slice(0, 400));
await page.click('#telaInicio .tile.tocavel:has-text("Despesas")'); await page.waitForTimeout(900);
let det = limpo(await folha().textContent());
conferir('5. Despesas abre o detalhamento', /Detalhamento/.test(await page.textContent('#folhaTitulo')), await page.textContent('#folhaTitulo'));
conferir('6. começa pelas despesas, dia a dia', det.indexOf('Despesas · R$ 55,39') >= 0 &&
  det.indexOf('Despesas · R$ 55,39') < det.indexOf('Faturamento · '), det.slice(0, 200));
conferir('7. ontem: a conta dos km, e quanto abasteceu',
  /Combustível · 03 nov\s*57,3 km ÷ 8,3 km\/l × R\$ 5,85\s*− R\$ 40,39\s*abasteceu R\$ 100,00/.test(det), det.slice(0, 400));
conferir('8. hoje: não abasteceu, fica fora do lucro', /Combustível · 04 nov\s*não abasteceu\s*R\$ 0,00\s*fora do lucro/.test(det), det.slice(0, 400));
conferir('9. a lavagem aparece', /Lavagem.*− R\$ 15,00/.test(det));
await page.screenshot({ path: dir + '/z59-detalhe-despesas.png', fullPage: true });
await page.goBack(); await page.waitForTimeout(700);

await page.click('#telaInicio .tile.tocavel:has-text("Lucro")'); await page.waitForTimeout(900);
det = limpo(await folha().textContent());
conferir('10. Lucro mostra a conta inteira',
  /Lucro\s*Faturamento\s*R\$ 150,19\s*Combustível\s*− R\$ 40,39\s*Outras despesas\s*− R\$ 15,00\s*Lucro\s*R\$ 94,80/.test(det), det.slice(0, 200));
await page.screenshot({ path: dir + '/z60-detalhe-lucro.png', fullPage: true });
await page.goBack(); await page.waitForTimeout(700);

await page.click('#telaInicio .tile.tocavel:has-text("Faturamento")'); await page.waitForTimeout(900);
det = limpo(await folha().textContent());
conferir('11. Faturamento lista os fechamentos', det.indexOf('Faturamento · R$ 150,19') === det.search(/Faturamento · /) &&
  /Dia 04 nov.*R\$ 76,59.*Dia 03 nov.*R\$ 73,60/.test(det), det.slice(0, 300));
await page.click('#folha .detalhe-uber-faturamento .linha >> nth=0'); await page.waitForTimeout(900);
conferir('12. tocar num registro abre ele', /Registro de/.test(await page.textContent('#folhaTitulo')), await page.textContent('#folhaTitulo'));
await page.goBack(); await page.waitForTimeout(800);
conferir('13. e voltar cai no detalhamento', /Detalhamento/.test(await page.textContent('#folhaTitulo')));


// ---- 05/11/2026: registro antigo com combustível dentro ----
await page.goBack(); await page.waitForTimeout(700);
await page.click('#telaInicio .linha:has-text("terça")'); await page.waitForTimeout(900);
await page.click('#folha .linha:has-text("Dia 03 nov")'); await page.waitForTimeout(900);
const antigo = limpo(await folha().textContent());
conferir('14. o registro antigo avisa do combustível lançado nele',
  /tem R\$ 40,39 de combustível lançado nele/.test(antigo) && /Combustível lançado nos registros\s*− R\$ 40,39/.test(antigo), antigo.slice(0, 300));
await page.click('#folha button:has-text("Tirar o combustível deste registro")'); await page.waitForTimeout(300);
const semComb = limpo(await folha().locator('.fechamento-resumo').textContent());
conferir('15. tirando, o lucro do dia volta', !/Combustível/.test(semComb) && /Lucro do dia\s*R\$ 58,60/.test(semComb), semComb);
await page.click('#folha .btn-ouro:has-text("Salvar registro")'); await page.waitForTimeout(1200);
for (let i = 0; i < 3 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
conferir('16. e as despesas do mês ficam só com a lavagem', /Despesas\s*R\$ 15,00/.test(await tela()), (await tela()).slice(0, 300));

// ---- 05/11/2026: no abastecimento, dois dos três calculam o outro ----
await page.click('#fab'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Abastecimento")'); await page.waitForTimeout(900);
const L0 = folha().getByLabel('Litros'), P0 = folha().getByLabel('Preço por litro'), T0 = folha().getByLabel('Total do abastecimento');
const valorDe = (loc) => ({ inputValue: async () => limpo((await loc.inputValue()).replace(/\u00a0/g, ' ')), click: () => loc.click(), fill: (v) => loc.fill(v), press: (k) => loc.press(k), type: (v) => loc.type(v) });
const L = valorDe(L0), P = valorDe(P0), T = valorDe(T0);
await dinheiro(P, '500'); await dinheiro(T, '10000');
const a1 = await L.inputValue();
await L.click(); await L.fill('2500');
const a2 = await P.inputValue(), a2t = await T.inputValue();
await dinheiro(P, '625');
const a3 = await T.inputValue(), a3l = await L.inputValue();
conferir('17. preço e total dão os litros', a1 === '20,00', a1);
conferir('18. total e litros dão o preço', a2 === 'R$ 4,00' && a2t === 'R$ 100,00', a2 + ' | ' + a2t);
conferir('19. litros e preço dão o total', a3 === 'R$ 156,25' && a3l === '25,00', a3 + ' | ' + a3l);
await page.screenshot({ path: dir + '/z61-abastecimento-tres.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar registro")'); await page.waitForTimeout(1000);
await page.click('#telaInicio .abas-modulo button:has-text("Gastos")'); await page.waitForTimeout(800);
await page.click('#telaInicio .linha:has-text("25,00 L")'); await page.waitForTimeout(900);
conferir('20. reabrindo, os três voltam como foram salvos',
  (await T.inputValue()) === 'R$ 156,25' && (await L.inputValue()) === '25,00' && (await P.inputValue()) === 'R$ 6,25');

// ---- 05/11/2026: os km do painel ficam registrados no abastecimento ----
const O = folha().getByLabel('Km do carro no painel (opcional)');
await O.click(); await O.type('45230');
conferir('21. os km do painel se formatam', (await O.inputValue()) === '45.230', await O.inputValue());
await page.click('#folha .btn-ouro:has-text("Salvar registro")'); await page.waitForTimeout(1000);
await page.click('#telaInicio button:has-text("+ Abastecimento")'); await page.waitForTimeout(900);
await folha().getByLabel('Data', { exact: true }).fill('2026-11-05'); await page.waitForTimeout(200);
const n1 = limpo(await folha().textContent());
await O.click(); await O.type('45460');
const n2 = limpo(await folha().textContent());
conferir('22. o abastecimento novo mostra o último registrado e quanto rodou',
  /Último registrado: 45\.230 km em 04\/11\/2026\./.test(n1) && /Rodou 230 km desde então/.test(n2), n2.slice(0, 400));
await L.click(); await L.fill('3000'); await dinheiro(P0, '600');
await page.click('#folha .btn-ouro:has-text("Salvar registro")'); await page.waitForTimeout(1000);
let gastos = await tela();
conferir('23. a lista mostra os km do painel e o que rodou', /− R\$ 180,00\s*45\.460 km \(\+230\)/.test(gastos) && /− R\$ 156,25\s*45\.230 km/.test(gastos), gastos.slice(0, 500));
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3500);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")').catch(() => {}); await page.waitForTimeout(800);
if (!(await page.locator('#telaInicio .modulo-cabecalho').count())) { await page.click('#telaInicio [data-modulo="uber"]'); await page.waitForTimeout(900); }
await page.click('#telaInicio .abas-modulo button:has-text("Gastos")').catch(() => {}); await page.waitForTimeout(800);
conferir('24. recarregando, os km continuam', /45\.460 km \(\+230\)/.test(await tela()));
await page.screenshot({ path: dir + '/z63-km-do-painel.png', fullPage: true });

console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\ntudo certo: detalhamento do Uber');
await browser.close();
process.exit(falhas ? 1 : 0);

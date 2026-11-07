// Uber: o registro do dia com o que o app da Uber mostra.
//
// Pedido do Vitor em 03/11/2026: ganhos, viagens, tempo online e km no fim
// do dia. Em 05/11/2026 o "Novo fechamento" virou "Novo registro" e o
// combustível saiu dele: o abastecimento entra só pelo Abastecimento e sai
// do lucro do dia.
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

// Relógio parado às 15h de hoje: o dia tem horas de sobra para a jornada,
// rode o teste a que hora for.
const agora = new Date(); agora.setHours(15, 0, 0, 0);
await page.clock.setFixedTime(agora);

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t147-' + Math.random().toString(36).slice(2) + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Uma jornada de 2 horas, encerrada agora.
await page.evaluate(() => new Promise(res => {
  const sufixo = Math.random().toString(36).slice(2);
  const fim = Date.now();
  const dados = { contas: [{ id: 'cc-t147-' + sufixo, nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 }],
                  lancamentos: [],
                  uberJornadas: [{ id: 'j-t147-' + sufixo, inicio: fim - 2 * 3600 * 1000, fim: fim, pausadoMs: 0, pausaDesde: 0 }] };
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

conferir('1. o cronômetro somou o tempo de hoje', /Tempo de hoje: 2h · editar/.test(await tela()), (await tela()).slice(0, 160));

// ---- corrigir o tempo: 5:04, como no app da Uber ----
await page.click('#telaInicio .tempo-do-dia'); await page.waitForTimeout(800);
await page.click('#folha .linha >> nth=0'); await page.waitForTimeout(800);
const campoTempo = folha().getByLabel('Tempo trabalhado (horas:minutos)');
await campoTempo.fill('5:04');
await page.click('#folha .btn-ouro:has-text("Salvar tempo")'); await page.waitForTimeout(900);
for (let i = 0; i < 3 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
conferir('2. dá para corrigir o tempo trabalhado', /Tempo de hoje: 5h 4min/.test(await tela()), (await tela()).match(/Tempo de hoje[^·]*/)?.[0]);

// ---- o registro do dia pelo "+" ----
// 05/11/2026: "Novo fechamento" virou "Novo registro", e o combustível saiu
// dele: abastecimento entra só pelo Abastecimento.
await page.click('#fab'); await page.waitForTimeout(700);
const menu = limpo(await page.textContent('#escolhaLista'));
await page.click('#escolhaLista .escolha-item:has-text("Novo registro")'); await page.waitForTimeout(900);
const formTxt = limpo(await folha().textContent());
conferir('3. o "+" abre o "Novo registro", com o tempo vazio e sem combustível',
  /Novo registro/.test(menu) && !/combustível/i.test(menu) &&
  /Novo registro/.test(await page.textContent('#folhaTitulo')) &&
  (await folha().getByLabel('Tempo online (horas:minutos)').inputValue()) === '' &&
  !/Média \(km\/l\)|Abastecido hoje|Preço do litro/.test(formTxt), formTxt.slice(0, 200));
await folha().getByLabel('Tempo online (horas:minutos)').fill('5:04');
await dinheiro(folha().locator('.valor-grande'), '25033');
await folha().locator('.contador-campo').fill('14');
await folha().getByLabel('Km rodados').fill('1200');
const prev = limpo(await folha().locator('.fechamento-resumo').textContent());
conferir('4. sem abastecimento no dia, o lucro é o ganho inteiro',
  /Lucro do dia\s*R\$ 250,33/.test(prev) && /Ganho por km\s*R\$ 2,09/.test(prev) && !/Combustível/.test(prev), prev);
conferir('5. e lembra onde lançar o abastecimento', /Abasteceu\? Lance em "\+" › Abastecimento/.test(prev));
await page.screenshot({ path: dir + '/z44-fechar-o-dia.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar registro")'); await page.waitForTimeout(1200);

let hoje = await tela();
conferir('6. Hoje mostra o registro',
  /Corridas\s*14/.test(hoje) && /Distância\s*120,0 km/.test(hoje) && /Faturamento\s*R\$ 250,33/.test(hoje) &&
  /Gastos\s*R\$ 0,00/.test(hoje) && /Lucro líquido\s*R\$ 250,33/.test(hoje), hoje.slice(0, 400));
conferir('7. ganho por hora usa o tempo online (R$ 250,33 em 5h04)', /Ganho por hora\s*R\$ 49,41/.test(hoje),
  (hoje.match(/Ganho por hora\s*\S+ \S+/) || [''])[0]);
conferir('8. o botão passa a ser "+ Mais um registro"', /\+ Mais um registro/.test(hoje));
await page.screenshot({ path: dir + '/z45-uber-dia-fechado.png', fullPage: true });

// ---- o abastecimento do dia sai do lucro ----
await page.click('#telaInicio .abas-modulo button:has-text("Gastos")'); await page.waitForTimeout(800);
await page.click('#telaInicio button:has-text("+ Abastecimento")'); await page.waitForTimeout(900);
await folha().getByLabel('Litros').fill('2000');
await dinheiro(folha().getByLabel('Preço por litro'), '500');
await page.click('#folha .btn-ouro:has-text("Salvar registro")'); await page.waitForTimeout(900);
await page.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await page.waitForTimeout(800);
hoje = await tela();
conferir('9. abastecer R$ 100,00 no dia entra nos gastos', /Gastos\s*R\$ 100,00/.test(hoje) && /Lucro líquido\s*R\$ 150,33/.test(hoje),
  (hoje.match(/Gastos\s*\S+ \S+/) || [''])[0]);

// ---- o histórico guarda o dia ----
await page.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await page.waitForTimeout(800);
await page.click('#telaInicio .linha:has-text("corrida(s)") >> nth=0'); await page.waitForTimeout(900);
const reg = limpo(await folha().textContent());
conferir('10. no histórico o dia aparece com viagens, tempo e km',
  /14 viagens/.test(reg) && /5:04 online · 120,0 km/.test(reg), reg.slice(0, 200));

// ---- recarregar mantém tudo ----
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3500);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")').catch(() => {}); await page.waitForTimeout(800);
if (!(await page.locator('#telaInicio .modulo-cabecalho').count())) { await page.click('#telaInicio [data-modulo="uber"]'); await page.waitForTimeout(900); }
await page.click('#telaInicio .abas-modulo button:has-text("Resumo")').catch(() => {}); await page.waitForTimeout(800);
hoje = await tela();
conferir('11. recarregando, o registro continua', /Faturamento\s*R\$ 250,33/.test(hoje) && /Lucro líquido\s*R\$ 150,33/.test(hoje));

// ---- excluir a jornada ----
await page.click('#telaInicio .tempo-do-dia'); await page.waitForTimeout(800);
await page.click('#folha .linha >> nth=0'); await page.waitForTimeout(800);
await page.click('#folha .btn-perigo:has-text("Excluir a jornada")'); await page.waitForTimeout(600);
await page.click('#dialogoAcoes button:has-text("Excluir")'); await page.waitForTimeout(1000);
for (let i = 0; i < 3 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
hoje = await tela();
conferir('12. dá para excluir a jornada; o dia registrado continua com o tempo dele',
  !/Tempo de hoje/.test(hoje) && /Ganho por hora\s*R\$ 49,41/.test(hoje), (hoje.match(/Ganho por hora\s*\S+ \S+/) || [''])[0]);

// ---- abrir o registro mostra o abastecimento do dia ----
await page.click('#telaInicio .linha:has-text("Dia ")'); await page.waitForTimeout(900);
const aberto = limpo(await folha().locator('.fechamento-resumo').textContent());
conferir('13. o registro aberto mostra o abastecimento do dia',
  /Registro de/.test(await page.textContent('#folhaTitulo')) &&
  /Abastecimentos do dia\s*− R\$ 100,00/.test(aberto) && /Lucro do dia\s*R\$ 150,33/.test(aberto), aberto.slice(0, 160));
await page.goBack(); await page.waitForTimeout(700);

// ---- 04/11/2026: dois registros no mesmo dia, e um de dia anterior ----
await page.click('#telaInicio button:has-text("+ Mais um registro")'); await page.waitForTimeout(900);
conferir('15. o segundo registro do dia avisa que soma com o primeiro',
  /Mais um registro/.test(await page.textContent('#folhaTitulo')) && /já tem 1 registro/.test(limpo(await folha().textContent())));
await dinheiro(folha().locator('.valor-grande'), '10000');
await folha().locator('.contador-campo').fill('4');
await folha().getByLabel('Tempo online (horas:minutos)').fill('2:00');
await folha().getByLabel('Km rodados').fill('400');
const seg = limpo(await folha().locator('.fechamento-resumo').textContent());
conferir('15b. e a conta do dia junta o primeiro', /Outros registros do dia\s*\+ R\$ 250,33/.test(seg) &&
  /Lucro do dia\s*R\$ 250,33/.test(seg), seg.slice(0, 200));
await page.click('#folha .btn-ouro:has-text("Salvar registro")'); await page.waitForTimeout(1200);
hoje = await tela();
// 250,33 + 100 = 350,33; gastos 100; lucro 250,33.
conferir('16. o dia soma os dois registros', /Corridas\s*18/.test(hoje) && /Faturamento\s*R\$ 350,33/.test(hoje) &&
  /Gastos\s*R\$ 100,00/.test(hoje) && /Lucro líquido\s*R\$ 250,33/.test(hoje), hoje.slice(0, 300));
conferir('17. e lista os dois, cada um com a hora', (hoje.match(/Registro \d\d \w+ \d\d:\d\d/g) || []).length === 2);

const ontem = await page.evaluate(() => { const d = new Date(); d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); });
await page.click('#telaInicio button:has-text("+ Mais um registro")'); await page.waitForTimeout(900);
await dinheiro(folha().locator('.valor-grande'), '8000');
await folha().getByLabel('Data', { exact: true }).fill(ontem);
await page.click('#folha .btn-ouro:has-text("Salvar registro")'); await page.waitForTimeout(1200);
conferir('18. um registro de ontem não entra no hoje', /Faturamento\s*R\$ 350,33/.test(await tela()));
await page.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await page.waitForTimeout(800);
conferir('19. e aparece no histórico', /R\$ 430,33/.test(await tela()), (await tela()).slice(0, 200));
await page.screenshot({ path: dir + '/z57-dois-fechamentos.png', fullPage: true });

// ---- 04/11/2026: os números se arrumam enquanto digita ----
await page.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await page.waitForTimeout(700);
await page.click('#telaInicio button:has-text("+ Mais um registro")'); await page.waitForTimeout(900);
const t = folha().getByLabel('Tempo online (horas:minutos)');
await t.click(); await t.type('3333'); const v1 = await t.inputValue();
await t.fill(''); await t.type('504'); const v2 = await t.inputValue();
const k = folha().getByLabel('Km rodados'); await k.click(); await k.type('431'); const v3 = await k.inputValue();
conferir('20. tempo e km se preenchem enquanto digita', v1 === '33:33' && v2 === '5:04' && v3 === '43,1', [v1, v2, v3].join(' | '));
await page.goBack(); await page.waitForTimeout(600);

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: registro do dia do Uber');

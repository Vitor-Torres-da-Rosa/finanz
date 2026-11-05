// Uber e Corridas: jornada com cronômetro, corridas com km, abastecimento,
// despesa extra, lucro líquido, ganho por km e por hora, e o histórico.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
// Relógio parado às 15h: a jornada de 2 horas começa no mesmo dia, rode o
// teste a que hora for (perto da meia-noite ela caía no dia anterior).
{ const quinze = new Date(); quinze.setHours(15, 0, 0, 0); await page.clock.setFixedTime(quinze); }
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const dinheiro = async (loc, digitos) => {
  await loc.click(); for (let i = 0; i < 12; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(150);
};
const tela = async () => limpo(await page.textContent('#telaInicio'));

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t142-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Uma jornada que começou há 2 horas: assim o ganho por hora tem tempo
// de verdade para dividir (abaixo de um minuto o app não arrisca a conta).
await page.evaluate(() => new Promise(res => {
  const sufixo = Date.now().toString(36);
  const dados = { contas: [{ id: 'cc-t142-' + sufixo, nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 }],
                  lancamentos: [],
                  uberJornadas: [{ id: 'j-t142-' + sufixo, inicio: Date.now() - 2 * 3600 * 1000, fim: 0, pausadoMs: 0, pausaDesde: 0 }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(900);

await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
const noHub = limpo(await page.textContent('#telaInicio [data-modulo="uber"]'));
conferir('1. com jornada aberta, o cartão do Uber mostra o tempo', /Em jornada\s*0?2:00:\d\d/.test(noHub), noHub);
await page.click('#telaInicio [data-modulo="uber"]'); await page.waitForTimeout(900);

// ---- o cronômetro saiu (03/11/2026): o tempo entra no "Fechar o dia" ----
conferir('2. não há mais cronômetro na tela', !(await page.locator('#telaInicio .anel-jornada').count()) && !/Iniciar jornada/.test(await tela()));
conferir('3. a jornada antiga que ficou ligada aparece para desligar', /Ficou um cronômetro ligado/.test(await tela()));

// ---- duas corridas: R$ 50 em 12 km e R$ 40 em 8 km (o "+" do módulo) ----
// Desde a 5.37.0 o "+" do Uber fecha o dia; a corrida avulsa tem botão.
await page.click('#fab'); await page.waitForTimeout(700);
const opcoesFab = limpo(await page.textContent('#escolhaLista'));
await page.click('#escolhaLista .escolha-item:has-text("Novo registro")'); await page.waitForTimeout(900);
const tituloFab = await page.textContent('#folhaTitulo') + ' · ' + opcoesFab;
await page.goBack(); await page.waitForTimeout(700);
await page.click('#telaInicio button:has-text("Corrida avulsa")'); await page.waitForTimeout(900);
conferir('4. o "+" pergunta o que registrar e "Corrida avulsa" abre a corrida',
  /Novo registro/.test(tituloFab) && /Abastecimento/.test(tituloFab) && /Outras despesas/.test(tituloFab) && /Nova corrida/.test(await page.textContent('#folhaTitulo')), tituloFab);
await dinheiro(folha().locator('.valor-grande'), '5000');
await folha().getByLabel('Distância (km)').fill('12');
await page.click('#folha .btn-ouro:has-text("Salvar corrida")'); await page.waitForTimeout(900);
await page.click('#telaInicio button:has-text("Corrida avulsa")'); await page.waitForTimeout(900);
await dinheiro(folha().locator('.valor-grande'), '4000');
await folha().getByLabel('Distância (km)').fill('8');
await page.click('#folha .chip:has-text("99")'); await page.waitForTimeout(150);
await page.click('#folha .btn-ouro:has-text("Salvar corrida")'); await page.waitForTimeout(900);

// ---- abastecimento: 10 L a R$ 5,00 ----
await page.click('#telaInicio .abas-modulo button:has-text("Gastos")'); await page.waitForTimeout(800);
await page.click('#telaInicio button:has-text("+ Abastecimento")'); await page.waitForTimeout(900);
await folha().getByLabel('Litros').fill('1000');
await dinheiro(folha().getByLabel('Preço por litro'), '500');
conferir('5. o abastecimento calcula o total', limpo((await folha().getByLabel('Total do abastecimento').inputValue()).replace(/\u00a0/g, ' ')) === 'R$ 50,00',
  await folha().getByLabel('Total do abastecimento').inputValue());
await page.click('#folha .btn-ouro:has-text("Salvar registro")'); await page.waitForTimeout(900);
await page.click('#telaInicio .abas-modulo button:has-text("Hoje")'); await page.waitForTimeout(800);

// ---- lavagem: R$ 15 ----
await page.click('#telaInicio button:has-text("Outras despesas")'); await page.waitForTimeout(900);
await dinheiro(folha().locator('.valor-grande'), '1500');
await page.click('#folha .chip:has-text("Lavagem")'); await page.waitForTimeout(150);
await page.click('#folha .btn-ouro:has-text("Salvar despesa")'); await page.waitForTimeout(900);

const hoje = await tela();
console.log('hoje:', hoje.slice(0, 400));
conferir('6. nesta jornada: 2 corridas, 20 km, R$ 90,00',
  /Corridas\s*2/.test(hoje) && /Distância\s*20,0 km/.test(hoje) && /Faturamento\s*R\$ 90,00/.test(hoje));
conferir('7. gastos R$ 65,00 e lucro líquido R$ 25,00', /Gastos\s*R\$ 65,00/.test(hoje) && /Lucro líquido\s*R\$ 25,00/.test(hoje));
conferir('8. ganho por km R$ 4,50', /Ganho por km\s*R\$ 4,50/.test(hoje));
conferir('9. ganho por hora: R$ 90 em 2 horas, perto de R$ 45,00', /Ganho por hora\s*R\$ 4[45],\d\d/.test(hoje), (hoje.match(/Ganho por hora\s*\S+ \S+/) || [''])[0]);
conferir('10. a lista mostra as corridas com R$/km', /12,0 km · Uber/.test(hoje) && /8,0 km · 99/.test(hoje) && /R\$ 5,00\/km/.test(hoje));
await page.screenshot({ path: dir + '/z30-uber-hoje.png', fullPage: true });

// ---- desligar a jornada antiga ----
await page.click('#telaInicio button:has-text("Desligar o cronômetro")'); await page.waitForTimeout(600);
const resumo = limpo(await page.textContent('#dialogoFundo'));
conferir('11. desligar mostra o resumo da jornada', /^Encerrar a jornada\? 2h/.test(resumo) && /2 corrida\(s\)/.test(resumo) && /lucrou R\$ 25,00/.test(resumo), resumo.slice(0, 160));
await page.click('#dialogoAcoes button:has-text("Encerrar")'); await page.waitForTimeout(900);
conferir('12. desligada, o aviso some e o tempo do dia fica para corrigir',
  !/Ficou um cronômetro ligado/.test(await tela()) && /Tempo de hoje: 2h/.test(await tela()));

// ---- histórico ----
await page.click('#telaInicio .abas-modulo button:has-text("Histórico")'); await page.waitForTimeout(800);
const barras = await page.locator('#telaInicio .barra-col').count();
const hist = await tela();
conferir('13. histórico do mês com uma barra por dia', barras >= 1 && /Faturamento\s*R\$ 90,00/.test(hist) && /Lucro\s*R\$ 25,00/.test(hist), barras + ' barras');
await page.click('#telaInicio .abas-modulo button:has-text("Semana")'); await page.waitForTimeout(600);
conferir('14. por semana: 8 barras', await page.locator('#telaInicio .barra-col').count() === 8);
await page.click('#telaInicio .abas-modulo button:has-text("Mês")'); await page.waitForTimeout(600);
conferir('15. por mês: 6 barras', await page.locator('#telaInicio .barra-col').count() === 6);
await page.screenshot({ path: dir + '/z31-uber-historico.png', fullPage: true });

// ---- gastos ----
await page.click('#telaInicio .abas-modulo button:has-text("Gastos")'); await page.waitForTimeout(800);
const gastos = await tela();
conferir('16. combustível: R$ 50,00, 10 litros, 2 km por litro',
  /R\$ 50,00/.test(gastos) && /10,00 litros/.test(gastos) && /2,0 km por litro/.test(gastos), gastos.slice(0, 260));
await page.click('#telaInicio .abas-modulo button:has-text("Extras")'); await page.waitForTimeout(600);
conferir('17. extras: a lavagem', /Lavagem/.test(await tela()) && /R\$ 15,00/.test(await tela()));

// ---- a entrada do Empreendedor ----
await page.click('#telaInicio .modulo-voltar'); await page.waitForTimeout(800);
const hub = limpo(await page.textContent('#telaInicio [data-modulo="uber"]'));
conferir('18. o cartão do Uber mostra o lucro do mês', /Lucro no mês\s*R\$ 25,00/.test(hub), hub);

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: uber e corridas');

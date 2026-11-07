// Uber: aba Resumo (Hoje + Histórico), Manutenção e km fora do Uber.
//
// Pedido do Vitor em 07/11/2026: os km do painel lançados nos
// abastecimentos dão os km atuais do carro; a Manutenção guarda as trocas
// (óleo, filtros) com o intervalo em km e avisa com 1.000 km, 500 km e
// quando vence, com "Irei trocar" e "Vou esperar um pouco". As anotações
// do carro aparecem a cada novo registro. E o que o painel rodou além dos
// km do Uber foi uso pessoal, com a gasolina estimada.
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
const dialogo = async () => limpo(await page.textContent('#dialogoTitulo')) + ' | ' + limpo(await page.textContent('#dialogoTexto'));
const dinheiro = async (loc, digitos) => {
  await loc.click(); for (let i = 0; i < 12; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(150);
};
const fecharFolhas = async () => {
  for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
};
const aba = async (nome) => { await page.click('#telaInicio .abas-modulo button:has-text("' + nome + '")'); await page.waitForTimeout(800); };

await page.clock.setFixedTime(new Date(2026, 10, 7, 15, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t157-' + Math.random().toString(36).slice(2) + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Painel: 45.000 km em 01/11 e 45.400 km em 05/11, 30 L cada a R$ 6,00.
// No meio, 200 km no Uber. Óleo trocado aos 40.800 (vence aos 45.800: faltam
// 400), filtro de ar aos 36.000 (vence aos 46.000: faltam 600).
await page.evaluate(() => new Promise(res => {
  const s = Math.random().toString(36).slice(2);
  const dados = { contas: [{ id: 'cc-t157-' + s, nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 }],
    lancamentos: [],
    uberRegistros: [
      { id: 'a1-' + s, tipo: 'abastecimento', data: '2026-11-01', litros: 30, precoLitro: 600, valor: 18000, odometro: 45000, combustivel: 'Gasolina', criadoEm: 1 },
      { id: 'd1-' + s, tipo: 'dia', data: '2026-11-03', hora: '20:00', valor: 30000, km: 200, viagens: 12, minutos: 300, plataforma: 'Uber', criadoEm: 2 },
      { id: 'a2-' + s, tipo: 'abastecimento', data: '2026-11-05', litros: 30, precoLitro: 600, valor: 18000, odometro: 45400, combustivel: 'Gasolina', criadoEm: 3 }
    ],
    uberTrocas: [
      { id: 't1-' + s, chave: 'oleo', km: 40800, data: '2026-07-01', criadoEm: 4 },
      { id: 't2-' + s, chave: 'filtro_ar', km: 36000, data: '2026-03-01', criadoEm: 5 },
      { id: 't3-' + s, chave: 'filtro_combustivel', km: 44000, data: '2026-10-01', criadoEm: 6 }
    ],
    uberNotas: [{ id: 'n1-' + s, texto: 'Barulho na suspensão dianteira', data: '2026-11-02', km: 45100, situacao: 'pendente', criadoEm: 7 }] };
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

let t = await tela();
const abas = await page.$$eval('#telaInicio .abas-modulo >> nth=0', () => 0).catch(() => 0);
conferir('1. as abas são Resumo, Manutenção e Gastos, e o Resumo traz o histórico',
  /Resumo\s*Manutenção\s*Gastos/.test(t) && /Histórico\s*Dia\s*Semana\s*Mês/.test(t) && !/\bHoje\s*Histórico\s*Gastos/.test(t), t.slice(0, 200));
conferir('2. no topo do Resumo, os alertas de troca',
  /Troca de óleo: troca muito próxima\s*Faltam 400 km\. A troca está prevista para 45\.800 km\./.test(t) &&
  /Filtro de ar do motor: troca se aproximando\s*Faltam 600 km/.test(t) && t.indexOf('Troca de óleo:') < t.indexOf('Filtro de ar do motor:'), t.slice(0, 500));
conferir('3. o filtro de combustível, longe, não alerta', !/Filtro de combustível:/.test(t));
conferir('4. km fora do Uber: 400 no painel − 200 no Uber = 200, e a gasolina estimada',
  /Km fora do Uber · novembro\s*Rodados no painel\s*400 km\s*No Uber\s*200,0 km\s*Fora do Uber\s*200,0 km\s*Gasolina estimada fora\s*− R\$ 90,00/.test(t) &&
  /média de 13,3 km\/l \(pelos litros abastecidos\) e litro a R\$ 6,00/.test(t), (t.match(/Km fora do Uber.{0,420}/) || [''])[0]);
await page.screenshot({ path: dir + '/z64-resumo-alertas.png', fullPage: true });

// ---- "Irei trocar" ----
await page.click('#telaInicio .alerta-manutencao:has-text("Troca de óleo") button:has-text("Irei trocar")'); await page.waitForTimeout(700);
let d = await dialogo();
conferir('5. "Irei trocar" lembra a anotação pendente e o que está perto',
  /Troca de óleo confirmada/.test(d) && /“Barulho na suspensão dianteira”/.test(d) && /Filtro de ar do motor \(faltam 600 km\)/.test(d), d);
await page.click('#dialogoAcoes button:has-text("Ver próximas trocas")'); await page.waitForTimeout(900);
const prox = limpo(await folha().textContent());
conferir('6. "Ver próximas trocas" lista da mais perto para a mais longe',
  /Próximas trocas/.test(await page.textContent('#folhaTitulo')) && prox.indexOf('Troca de óleo') < prox.indexOf('Filtro de ar do motor') &&
  prox.indexOf('Filtro de ar do motor') < prox.indexOf('Filtro de combustível'), prox.slice(0, 300));
await fecharFolhas();
t = await tela();
conferir('7. o alerta do óleo vira "troca combinada", com "Registrar a troca"',
  /Troca de óleo: troca combinada/.test(t) && await page.locator('#telaInicio .alerta-manutencao:has-text("Troca de óleo") button:has-text("Registrar a troca")').count() === 1);

// ---- "Vou esperar um pouco" ----
await page.click('#telaInicio .alerta-manutencao:has-text("Filtro de ar") button:has-text("Vou esperar um pouco")'); await page.waitForTimeout(700);
d = await dialogo();
conferir('8. "Vou esperar" explica o risco, com tom profissional', /Entendido/.test(d) && /filtro de ar sujo/.test(d) && /volta a avisar/.test(d), d);
await page.click('#dialogoAcoes button:has-text("Ok")'); await page.waitForTimeout(700);
conferir('9. e o alerta do filtro de ar some até chegar mais perto', !/Filtro de ar do motor:/.test(await tela()));

// ---- registrar a troca do óleo ----
await page.click('#telaInicio .alerta-manutencao:has-text("Troca de óleo") button:has-text("Registrar a troca")'); await page.waitForTimeout(900);
const kmTroca = folha().getByLabel('Km do carro na troca');
conferir('10. a troca já vem com os km atuais do carro', (await kmTroca.inputValue()) === '45.400', await kmTroca.inputValue());
await dinheiro(folha().getByLabel('Quanto custou (opcional)'), '18000');
await folha().getByLabel('Observação (opcional)').fill('5W30 sintético');
await page.click('#folha .btn-ouro:has-text("Salvar troca")'); await page.waitForTimeout(1100);
t = await tela();
conferir('11. trocado, o alerta sai e o custo entra nos gastos de hoje', !/Troca de óleo:/.test(t) && /Gastos\s*R\$ 180,00/.test(t), t.slice(0, 300));

// ---- a aba Manutenção ----
await aba('Manutenção');
t = await tela();
conferir('12. Manutenção mostra os km atuais pelo painel', /Km atual do carro\s*45\.400 km\s*Pelo painel no abastecimento de 05\/11\/2026/.test(t), t.slice(0, 200));
conferir('13. e as trocas, com quanto falta',
  /Troca de óleo\s*trocado com 45\.400 km · 07 nov\s*faltam 5\.000 km\s*em 50\.400 km/.test(t) &&
  /Filtro de óleo\s*registre a última troca/.test(t), t.slice(0, 700));
conferir('14. a anotação pendente e o histórico de trocas', /Anotações do carro\s*Barulho na suspensão dianteira/.test(t) && /Trocas feitas\s*Troca de óleo\s*07\/11\/2026 · 45\.400 km · 5W30 sintético\s*− R\$ 180,00/.test(t));
await page.screenshot({ path: dir + '/z65-manutencao.png', fullPage: true });

// ---- mudar o nome e o intervalo ----
await page.click('#telaInicio .linha:has-text("Filtro de ar do motor")'); await page.waitForTimeout(900);
await folha().getByLabel('Qual produto ou peça (opcional)').fill('Tecfil');
const intervalo = folha().getByLabel('Trocar a cada (km)');
await intervalo.fill(''); await intervalo.type('12000');
await page.click('#folha button:has-text("Salvar alterações")'); await page.waitForTimeout(1000);
t = await tela();
conferir('15. dá para mudar o produto e os km de troca', /Filtro de ar do motor · Tecfil\s*trocado com 36\.000 km · 01 mar\s*faltam 2\.600 km\s*em 48\.000 km/.test(t), (t.match(/Filtro de ar do motor ·.{0,120}/) || [''])[0]);

// ---- item vencido: "Vou esperar" volta a cada 300 km ----
await page.click('#telaInicio .linha:has-text("Filtro de óleo")'); await page.waitForTimeout(900);
await page.click('#folha .btn-ouro:has-text("Registrar a última troca")'); await page.waitForTimeout(900);
const kmF = folha().getByLabel('Km do carro na troca');
await kmF.fill(''); await kmF.type('40000');
await folha().getByLabel('Data', { exact: true }).fill('2026-06-01');
await page.click('#folha .btn-ouro:has-text("Salvar troca")'); await page.waitForTimeout(1000);
await fecharFolhas();
await aba('Resumo');
t = await tela();
conferir('16. vencido, o alerta é de urgência', /Filtro de óleo: troca vencida\s*Passou 400 km do previsto \(45\.000 km\)\. Faça a troca o quanto antes\./.test(t), t.slice(0, 300));
await page.click('#telaInicio .alerta-manutencao:has-text("Filtro de óleo") button:has-text("Vou esperar um pouco")'); await page.waitForTimeout(700);
d = await dialogo();
conferir('17. adiando um vencido, o app pede para não rodar muito', /evite rodar muito com o carro assim/.test(d) && /300 km/.test(d), d);
await page.click('#dialogoAcoes button:has-text("Ok")'); await page.waitForTimeout(700);
conferir('18. e esconde o alerta por enquanto', !/Filtro de óleo: troca vencida/.test(await tela()));
await aba('Gastos');
await page.click('#telaInicio button:has-text("+ Abastecimento")'); await page.waitForTimeout(900);
await folha().getByLabel('Litros').fill('1000'); await dinheiro(folha().getByLabel('Preço por litro'), '600');
const odo = folha().getByLabel('Km do carro no painel (opcional)'); await odo.click(); await odo.type('45750');
await page.click('#folha .btn-ouro:has-text("Salvar registro")'); await page.waitForTimeout(1000);
await aba('Resumo');
conferir('19. rodados mais 350 km, o alerta vencido volta', /Filtro de óleo: troca vencida\s*Passou 750 km/.test(await tela()), (await tela()).slice(0, 200));

// ---- anotações no novo registro ----
await page.click('#telaInicio button:has-text("+ Mais um registro"), #telaInicio button:has-text("Novo registro")'); await page.waitForTimeout(900);
let f = limpo(await folha().textContent());
conferir('20. o novo registro lembra o que está pendente no carro', /Pendente no carro\s*Barulho na suspensão dianteira\s*Resolvido/.test(f), f.slice(0, 600));
await dinheiro(folha().locator('.valor-grande'), '10000');
await folha().getByLabel('Notou algo no carro? (opcional)').fill('Pastilha de freio chiando');
await page.click('#folha .btn-ouro:has-text("Salvar registro")'); await page.waitForTimeout(1100);
await page.click('#telaInicio button:has-text("+ Mais um registro")'); await page.waitForTimeout(900);
await page.click('#folha .nota-pendente:has-text("Barulho") button:has-text("Resolvido")'); await page.waitForTimeout(500);
f = limpo(await folha().textContent());
conferir('21. "Resolvido" tira da lista na hora', !/Barulho na suspensão/.test(f) && /Pastilha de freio chiando/.test(f), f.slice(0, 400));
await fecharFolhas();
await aba('Manutenção');
t = await tela();
conferir('22. a anotação do registro foi para a Manutenção, e a resolvida saiu das pendentes',
  /Anotações do carro\s*Pastilha de freio chiando/.test(t) && !/Barulho na suspensão dianteira/.test(t) && /Ver as resolvidas \(1\)/.test(t), (t.match(/Anotações do carro.{0,200}/) || [''])[0]);

// ---- recarregar mantém tudo ----
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3500);
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")').catch(() => {}); await page.waitForTimeout(800);
if (!(await page.locator('#telaInicio .modulo-cabecalho').count())) { await page.click('#telaInicio [data-modulo="uber"]'); await page.waitForTimeout(900); }
await aba('Manutenção');
t = await tela();
conferir('23. recarregando, trocas, itens e anotações continuam',
  /Km atual do carro\s*45\.750 km/.test(t) && /Filtro de ar do motor · Tecfil/.test(t) && /Pastilha de freio chiando/.test(t) && /5W30 sintético/.test(t), t.slice(0, 300));

console.log(falhas ? `\n${falhas} verificação(ões) falharam` : '\ntudo certo: manutenção do carro');
await browser.close();
process.exit(falhas ? 1 : 0);

// O "+" com menu e a despesa no cartão com fatura, parcelas e repetição.
//
// Pedido do Vitor em 01/11/2026, com prints de outro app que ele usava:
// o "+" da Visão geral abre Transferência, Receita, Despesa e Despesa
// cartão (no Empreendedor continua sendo cliente novo). A despesa no
// cartão escolhe o cartão e a fatura (‹ dezembro ›), e dá para parcelar
// (total, começar na parcela, frequência, a cada N dias) ou fixar todo mês.
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
const MESES = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
const digitar = async (d) => {
  const v = folha().locator('.valor-grande');
  await v.click(); for (let i = 0; i < 12; i++) await v.press('Backspace');
  await v.type(d); await page.waitForTimeout(250);
};
const menu = async (opcao) => {
  await page.click('#fab'); await page.waitForTimeout(400);
  await page.click('#menuNovo.aberto button[data-opcao="' + opcao + '"]'); await page.waitForTimeout(900);
};
// Os dados ficam cifrados no aparelho; quem responde é o servidor, depois
// que o app sobe. Espera subir até a condição bater (ou desiste em 20 s).
const doServidor = async (filtrar, ate) => {
  let linhas = [];
  for (let i = 0; i < 20; i++) {
    linhas = await page.evaluate(async () => {
      const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
      const cfg = window.FINANZ_CONFIG;
      const r = await fetch(cfg.supabaseUrl + '/rest/v1/lancamentos?select=*', {
        headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
      return r.json();
    });
    linhas = (Array.isArray(linhas) ? linhas : []).filter(l => !l.excluido_em).filter(filtrar);
    if (ate(linhas)) return linhas;
    await page.waitForTimeout(1000);
  }
  return linhas;
};
const fecharTudo = async () => {
  for (let i = 0; i < 4; i++) {
    if (!(await page.locator('#folha.aberta').count())) return;
    await page.goBack(); await page.waitForTimeout(600);
  }
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t140-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// ---- sem cartão: o app pede para cadastrar ----
await page.click('#fab'); await page.waitForTimeout(500);
const itens = await page.$$eval('#menuNovo.aberto .menu-novo-item', ns => ns.map(n => n.textContent.trim()));
conferir('1. o "+" abre o menu com as quatro opções, nessa ordem',
  itens.join('|') === 'Transferência|Receita|Despesa|Despesa cartão', itens.join(' | '));
await page.screenshot({ path: dir + '/z26-menu-novo.png' });
await page.click('#menuNovo.aberto button[data-opcao="cartao"]'); await page.waitForTimeout(900);
conferir('2. sem cartão, oferece cadastrar um', /Nenhum cartão ainda/.test(limpo(await page.textContent('#dialogoFundo').catch(() => ''))));
await page.click('#dialogoAcoes button:has-text("Agora não"), #dialogoAcoes button:has-text("Cancelar")').catch(() => {});
await page.waitForTimeout(600);
await fecharTudo();

// Uma conta e um cartão que fecha dia 3 e vence dia 10.
await page.evaluate(() => new Promise(res => {
  // Ids únicos: o banco de teste é de todos os testes, e um id repetido de
  // outro usuário faz o servidor recusar a conta (e o envio inteiro).
  const sufixo = Date.now().toString(36);
  const dados = { contas: [{ id: 'cc-t140-' + sufixo, nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 },
                           { id: 'c6-t140-' + sufixo, nome: 'C6 cartao', tipo: 'Cartão de crédito', saldoInicial: 0,
                             banco: 'c6', fechamento: 3, vencimento: 10, limite: 1000000 }],
                  lancamentos: [] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1000);

// ---- no Empreendedor o "+" continua sendo cliente novo ----
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(800);
await page.click('#fab'); await page.waitForTimeout(800);
conferir('3. no Empreendedor não tem menu: abre o cliente novo',
  !(await page.locator('#menuNovo.aberto').count()) && /cliente/i.test(await page.textContent('#folhaTitulo')),
  await page.textContent('#folhaTitulo'));
await fecharTudo();
await page.click('#telaInicio .segmentos button:has-text("Visão geral")'); await page.waitForTimeout(800);

// ---- Receita pelo menu ----
await menu('entrada');
conferir('4. "Receita" abre já como entrada',
  /Nova receita/.test(await page.textContent('#folhaTitulo')) &&
  (await page.getAttribute('#folha .forma', 'data-tipo')) === 'entrada');
await fecharTudo();

// ---- Despesa no cartão, parcelada em 3, na fatura seguinte ----
await menu('cartao');
const titulo = await page.textContent('#folhaTitulo');
conferir('5. "Despesa cartão" abre a despesa no cartão', /Nova despesa no cartão/.test(titulo), titulo);
conferir('6. o cartão já vem escolhido', /C6 cartao/.test(limpo(await page.textContent('#folha'))));

const hoje = new Date();
const daFatura = (d) => (d.getDate() > 3 ? new Date(d.getFullYear(), d.getMonth() + 1, 1) : new Date(d.getFullYear(), d.getMonth(), 1));
const naturalF = daFatura(hoje);
const rotulo = (d) => MESES[d.getMonth()] + ' de ' + d.getFullYear();
const mesFatura = limpo(await page.textContent('#folha .fatura-mes')).toLowerCase();
conferir('7. a fatura é a da data da compra', mesFatura === rotulo(naturalF), mesFatura);

await page.click('#folha .fatura-seta[aria-label="Próxima fatura"]'); await page.waitForTimeout(300);
const proxima = new Date(naturalF.getFullYear(), naturalF.getMonth() + 1, 1);
conferir('8. a seta passa para a fatura seguinte', limpo(await page.textContent('#folha .fatura-mes')).toLowerCase() === rotulo(proxima));

await digitar('30000');
await folha().locator('input.entrada[type=text]').first().fill('Geladeira');
await page.click('#folha .caixa-repeticao .segmentos button:has-text("Parcelada")'); await page.waitForTimeout(300);
await page.click('#folha .config-linha:has-text("Total de parcelas") .contador-botao[aria-label="Aumentar"]'); await page.waitForTimeout(200);
const previa = limpo(await page.textContent('#folha .previa-repeticao'));
const curto = (d) => MESES[d.getMonth()].slice(0, 3) + '/' + d.getFullYear();
const ultima = new Date(proxima.getFullYear(), proxima.getMonth() + 2, 1);
conferir('9. a prévia mostra 3 de R$ 100 e as faturas',
  previa.indexOf('3 lançamentos de R$ 100,00, nas faturas de ' + curto(proxima) + ' a ' + curto(ultima)) === 0, previa);
await page.screenshot({ path: dir + '/z27-despesa-cartao.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);

const subiram = await doServidor(l => /Geladeira/.test(l.descricao), ls => ls.length === 3);
conferir('10a. as 3 parcelas sobem para o servidor com o mesmo grupo',
  subiram.length === 3 && !!subiram[0].grupo && subiram.every(l => l.grupo === subiram[0].grupo),
  subiram.length + ' · grupo ' + (subiram[0] || {}).grupo);
await page.click('#telaInicio .linha-alvo:has-text("C6 cartao")'); await page.waitForTimeout(1200);
const faturas = await page.$$eval('#folha .cartao', ns => {
  const f = ns.find(n => /Faturas/.test(n.textContent));
  return f ? [...f.querySelectorAll('.linha')].map(l => l.textContent.replace(/\s+/g, ' ').trim()) : [];
});
console.log('faturas:', faturas);
const esperado = [ultima, new Date(proxima.getFullYear(), proxima.getMonth() + 1, 1), proxima].map(rotulo);
conferir('10. uma parcela em cada uma das 3 faturas seguidas',
  faturas.length === 3 && esperado.every((r, i) => faturas[i].indexOf(r) === 0 && /R\$ 100,00/.test(faturas[i])),
  faturas.join(' | '));
const gastos = limpo(await page.textContent('#folha'));
conferir('11. cada uma com "(1/3)", "(2/3)", "(3/3)"', /Geladeira \(1\/3\)/.test(gastos) && /Geladeira \(3\/3\)/.test(gastos));

// Abrindo uma parcela: dá para apagar as três de uma vez.
await page.click('#folha .linha-alvo:has-text("Geladeira (2/3)")'); await page.waitForTimeout(1200);
const edicao = limpo(await page.textContent('#folha'));
conferir('12. editando uma parcela, oferece excluir as 3', /Excluir todas as 3 do grupo/.test(edicao));
await page.click('#folha .btn-perigo:has-text("Excluir todas as 3")'); await page.waitForTimeout(600);
await page.click('#dialogoAcoes button:has-text("Excluir todas")'); await page.waitForTimeout(1500);
const restam = (await doServidor(l => /Geladeira/.test(l.descricao), ls => ls.length === 0)).length;
conferir('13. e as 3 saem juntas', restam === 0, restam);
await fecharTudo();

// ---- Despesa fixa mensal: 12 meses ----
await menu('saida');
await digitar('150000');
await folha().locator('input.entrada[type=text]').first().fill('Aluguel');
await page.click('#folha .caixa-repeticao .segmentos button:has-text("Fixa mensal")'); await page.waitForTimeout(300);
conferir('14. fixa mensal avisa dos 12 meses', /12 lançamentos de R\$ 1\.500,00/.test(limpo(await page.textContent('#folha .previa-repeticao'))));
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);
const alugueisL = await doServidor(l => l.descricao === 'Aluguel', ls => ls.length >= 12);
const alugueis = alugueisL.map(l => l.data).sort();
conferir('15a. as 12 sobem juntas, com o mesmo grupo',
  alugueisL.length === 12 && !!alugueisL[0].grupo && alugueisL.every(l => l.grupo === alugueisL[0].grupo));
conferir('15. lançou 12, um por mês', alugueis.length === 12 &&
  new Set(alugueis.map(d => d.slice(0, 7))).size === 12, alugueis.length + ' · ' + alugueis[0] + ' a ' + alugueis[11]);

// ---- Personalizar: a cada 2 dias, valor de cada parcela ----
await menu('saida');
await digitar('5000');
await folha().locator('input.entrada[type=text]').first().fill('Diária');
await page.click('#folha .caixa-repeticao .segmentos button:has-text("Parcelada")'); await page.waitForTimeout(300);
await page.click('#folha .config-linha:has-text("Total de parcelas") .contador-botao[aria-label="Aumentar"]'); await page.waitForTimeout(200);
await page.click('#folha .config-linha:has-text("Frequência") .selecao'); await page.waitForTimeout(600);
await page.click('#escolhaLista .escolha-item:has-text("Personalizar")'); await page.waitForTimeout(700);
await page.click('#folha .segmentos button:has-text("Valor é de cada parcela")'); await page.waitForTimeout(200);
conferir('16. personalizar pergunta "a cada quantos dias"', /Repetir a cada \(dias\)/.test(limpo(await page.textContent('#folha'))));
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);
const diarias = (await doServidor(l => /^Diária/.test(l.descricao), ls => ls.length >= 3))
  .sort((a, b) => a.data < b.data ? -1 : 1).map(l => l.data + ' ' + l.valor + ' ' + l.descricao);
console.log('diárias:', diarias);
const dia0 = new Date(diarias.length ? diarias[0].slice(0, 10) + 'T12:00' : 0);
const dif = (s) => Math.round((new Date(s.slice(0, 10) + 'T12:00') - dia0) / 86400000);
conferir('17. três lançamentos de R$ 50, a cada 2 dias',
  diarias.length === 3 && diarias.every(d => / 5000 /.test(d)) && dif(diarias[1]) === 2 && dif(diarias[2]) === 4,
  diarias.join(' | '));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: menu do "+" e despesa no cartão');

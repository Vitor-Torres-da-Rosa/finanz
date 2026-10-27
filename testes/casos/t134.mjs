// Juntar transferência não pode mais sumir com a linha do extrato.
//
// Até a 5.24.1 juntar um par APAGAVA os dois lançamentos e criava um
// terceiro, do tipo 'transferencia'. O saldo continuava certo, mas a linha
// que a pessoa reconhece do extrato do banco sumia: no lugar das duas
// ficava uma só, com a data e a descrição do OUTRO lado. Medido em
// 27/10/2026: "PIX TRANSF VITOR, dia 7" virava "Pix enviado para VITOR,
// dia 5". Conferir o app contra o banco virava impossível, e não havia
// como desfazer — o outro lado não existia mais.
//
// Vitor, 27/10/2026: "não vai acontecer nada nesses lançamentos (...)
// quero que continuem somando mas que apareçam lá na aba de transferência
// pra mim conferir depois".
//
// E o cartão passou a ficar fora do pareamento: uma compra no cartão com o
// mesmo valor de uma entrada na corrente era oferecida como par, e aceitar
// isso apagava uma despesa de verdade.
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
const semDialogo = async () => {
  if (!(await page.locator('#dialogoFundo.aberta').count())) return '';
  const t = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
  const bs = page.locator('#dialogoAcoes button');
  await bs.nth((await bs.count()) - 1).click();
  await page.waitForTimeout(900);
  return t;
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
const retrato = async () => {
  await irParaInicio(); await page.waitForTimeout(1400);
  const t = limpo(await page.textContent('#telaInicio'));
  const pega = (re) => { const m = t.match(re); return m ? m[1] : '(?)'; };
  return {
    inter: pega(/Banco Inter[^R]*(−?-?R\$ [\d.,]+)/),
    c6: pega(/C6 Bank[^R]*(−?-?R\$ [\d.,]+)/),
    total: pega(/Total em contas\s*(−?-?R\$ [\d.,]+)/),
    receitas: pega(/Receitas\s*(−?-?R\$ [\d.,]+)/),
    despesas: pega(/Despesas\s*(−?-?R\$ [\d.,]+)/)
  };
};
const extratoDe = async (nome) => {
  await irParaInicio(); await page.waitForTimeout(800);
  await page.click('#telaInicio .cartao:has-text("Contas") .linha:has-text("' + nome + '")');
  await page.waitForTimeout(1500);
  const t = limpo(await page.textContent('#folha').catch(() => ''));
  await page.keyboard.press('Escape'); await page.waitForTimeout(900);
  return t;
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t134-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Duas contas e um cartão. O par verdadeiro sai do C6 dia 5 e cai no
// Inter dia 7. A armadilha do cartão: uma compra de R$ 90 no cartão e uma
// entrada de R$ 90 no Inter, no mesmo valor e a dois dias.
const hoje = new Date();
const dia = (n) => hoje.getFullYear() + '-' + String(hoje.getMonth() + 1).padStart(2, '0') +
                   '-' + String(n).padStart(2, '0');
await page.evaluate((d) => new Promise((res) => {
  const dados = {
    contas: [
      { id: 'cc', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 },
      { id: 'c6', nome: 'C6 Bank', tipo: 'Conta corrente', saldoInicial: 0 },
      { id: 'cx', nome: 'Cartão Nubank', tipo: 'Cartão de crédito', saldoInicial: 0 }
    ],
    lancamentos: [
      { id: 'e0', tipo: 'entrada', valor: 200000, data: d[0], contaId: 'c6',
        categoria: 'Serviços', descricao: 'Salário' },
      { id: 's1', tipo: 'saida', valor: 50000, data: d[1], contaId: 'c6',
        categoria: 'Outros', descricao: 'Pix enviado para VITOR' },
      { id: 'e1', tipo: 'entrada', valor: 50000, data: d[2], contaId: 'cc',
        categoria: 'Outros', descricao: 'PIX TRANSF VITOR' },
      // A armadilha: mesmo valor, dois dias de diferença, contas diferentes.
      { id: 'k1', tipo: 'saida', valor: 9000, data: d[1], contaId: 'cx',
        categoria: 'Alimentação', descricao: 'Mercado no cartão' },
      { id: 'k2', tipo: 'entrada', valor: 9000, data: d[2], contaId: 'cc',
        categoria: 'Outros', descricao: 'Reembolso' }
    ]
  };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}), [dia(1), dia(5), dia(7)]);
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);

// ---- o cartão não pode ser oferecido como par ----
await irParaInicio(); await page.waitForTimeout(1400);
const inicio = limpo(await page.textContent('#telaInicio'));
const achou = inicio.match(/Achei (\d+) saídas? com o mesmo valor/);
conferir('1. o app acha 1 par só — a compra no cartão fica de fora',
  !!achou && achou[1] === '1', achou ? achou[0] : '(nenhum par achado)');

const antes = await retrato();
console.log('antes  ·', JSON.stringify(antes));
const interAntes = await extratoDe('Banco Inter');
conferir('2. antes de juntar, o extrato do Inter tem a linha do banco',
  /PIX TRANSF VITOR/.test(interAntes));

// ---- junta o par ----
await irParaInicio();
await page.click('#telaInicio .cartao:has-text("Transferências entre contas") .btn-ouro');
await page.waitForTimeout(1500);
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1200);
await page.locator('#dialogoAcoes button').nth(0).click(); await page.waitForTimeout(3500);
await semDialogo();

const depois = await retrato();
console.log('depois ·', JSON.stringify(depois));
conferir('3. os saldos das contas não mudam ao juntar',
  depois.inter === antes.inter && depois.c6 === antes.c6 && depois.total === antes.total,
  antes.inter + '/' + antes.c6 + '/' + antes.total + ' → ' +
  depois.inter + '/' + depois.c6 + '/' + depois.total);
conferir('4. mas os R$ 500,00 saem de receitas e de despesas',
  antes.receitas === 'R$ 2.590,00' && depois.receitas === 'R$ 2.090,00' &&
  antes.despesas === 'R$ 590,00' && depois.despesas === 'R$ 90,00',
  'receitas ' + antes.receitas + ' → ' + depois.receitas +
  ' · despesas ' + antes.despesas + ' → ' + depois.despesas);

// ---- e a linha do banco continua lá, com a data dela ----
const interDepois = await extratoDe('Banco Inter');
conferir('5. a linha "PIX TRANSF VITOR" continua no extrato do Inter',
  /PIX TRANSF VITOR/.test(interDepois), interDepois.slice(0, 160));
conferir('6. e o subtítulo dela diz de onde veio o dinheiro',
  /⇄ Veio de C6 Bank/.test(interDepois),
  (interDepois.match(/⇄ [^·]*/) || ['(não achei)'])[0]);
await page.screenshot({ path: dir+'/v01-extrato-preservado.png', fullPage: true });

// ---- as duas pernas aparecem na aba de Transferências ----
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1300);
await page.click('#telaTransacoes :text("Transferências")'); await page.waitForTimeout(1300);
const naAba = limpo(await page.textContent('#telaTransacoes').catch(() => ''));
conferir('7. a aba Transferências mostra as duas pernas',
  /PIX TRANSF VITOR/.test(naAba) && /Pix enviado para VITOR/.test(naAba),
  naAba.slice(0, 150));
conferir('8. com a etiqueta dizendo que ficam fora de receitas e despesas',
  /fora de receitas e despesas/.test(naAba));
await page.screenshot({ path: dir+'/v02-aba-transferencias.png', fullPage: true });

// ---- e dá para separar, que antes era impossível ----
await page.click('#telaTransacoes .linha:has-text("PIX TRANSF VITOR")'); await page.waitForTimeout(1500);
const temSeparar = await page.locator('#folha button:has-text("Separar da transferência")').count();
conferir('9. a folha do lançamento oferece separar o par', temSeparar === 1, temSeparar + ' botão(ões)');
if (temSeparar) {
  await page.click('#folha button:has-text("Separar da transferência")'); await page.waitForTimeout(1000);
  await page.locator('#dialogoAcoes button').nth(0).click(); await page.waitForTimeout(2500);
  await semDialogo();
}
const voltou = await retrato();
conferir('10. separando, os dois voltam a contar como receita e despesa',
  voltou.receitas === antes.receitas && voltou.despesas === antes.despesas,
  'receitas ' + voltou.receitas + ' · despesas ' + voltou.despesas);
conferir('11. e os saldos continuam os mesmos o tempo todo',
  voltou.total === antes.total, voltou.total);
await page.screenshot({ path: dir+'/v03-separado.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: juntar marca o par em vez de apagar os lançamentos');

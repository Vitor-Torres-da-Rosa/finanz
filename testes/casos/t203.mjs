// "Possíveis repetidos" some depois que a pessoa confirma que o saldo está
// certo (Conferido ✓, pedido do Vitor em 26/11/2026). Repetido que entrar
// depois da confirmação volta a aparecer. A marca sobrevive ao recarregar.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t203-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

const antes = 1700000000000, marca = 1800000000000, depois = 1900000000000;
await page.evaluate(({ antes, marca, depois }) => new Promise(res => {
  const l = [];
  const par = (conta, pre, c1, c2) => {
    l.push({ id: pre + '1', tipo: 'saida', valor: 4590, data: '2026-11-10', contaId: conta, categoria: 'Outros', descricao: 'Padaria', criadoEm: c1 });
    l.push({ id: pre + '2', tipo: 'saida', valor: 4590, data: '2026-11-10', contaId: conta, categoria: 'Outros', descricao: 'Padaria', criadoEm: c2 });
  };
  par('conf', 'a', antes, antes);   // conferida depois dos dois: some
  par('nova', 'b', antes, antes);   // nunca conferida: aparece
  par('volta', 'c', antes, depois); // um entrou depois da conferência: aparece
  const dados = {
    contas: [{ id: 'conf', nome: 'Conta Conferida', tipo: 'Conta corrente', saldoInicial: 0 },
             { id: 'nova', nome: 'Conta Nova', tipo: 'Conta corrente', saldoInicial: 0 },
             { id: 'volta', nome: 'Conta Volta', tipo: 'Conta corrente', saldoInicial: 0 }],
    lancamentos: l,
    revisados: { 'repetidos:conf': marca, 'repetidos:volta': marca }
  };
  const f = new File([JSON.stringify({ app: 'caixa', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 700);
}), { antes, marca, depois });
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(2500);

const repetidosNa = async (nome) => {
  for (let i = 0; i < 4 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
  await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
  await page.click('#telaInicio .cartao:has-text("Contas") .linha:has-text("' + nome + '")'); await page.waitForTimeout(1200);
  await page.click('#folha .botao-saldo-correto'); await page.waitForTimeout(500);
  await page.click('#folha .btn-ouro:has-text("Conferir esta conta")'); await page.waitForTimeout(1500);
  return page.locator('#folha .rotulo:has-text("Possíveis repetidos")').count();
};

conferir('1. conta conferida depois dos repetidos: a lista some', await repetidosNa('Conta Conferida') === 0);
conferir('2. conta nunca conferida: os repetidos aparecem', await repetidosNa('Conta Nova') === 1);
await page.screenshot({ path: dir + '/z203-repetidos.png' });
conferir('3. repetido que entrou depois da conferência volta a aparecer', await repetidosNa('Conta Volta') === 1);

await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(5000);
conferir('4. recarregando o app, a marca da conferência continua', await repetidosNa('Conta Conferida') === 0);
console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

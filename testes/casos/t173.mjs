// Sincronização com muitas exclusões (17/11/2026). O Vitor apagou 2744
// lançamentos, e salvar virou milhares de pedidos em fila: bastava um
// tropeço da rede para aparecer "não achei o servidor" e tudo recomeçar.
// Agora as exclusões vão em lotes, e uma falha passageira é tentada de novo.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };

await page.clock.setFixedTime(new Date(2026, 10, 17, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('finanz.cofre.auto', 'senha-do-cofre-123'); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t173-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

const marca = Math.random().toString(36).slice(2, 8);
const restaurar = async (quantos) => {
  await page.evaluate(([quantos, marca]) => new Promise(res => {
    const lanc = [];
    for (let i = 0; i < quantos; i++) lanc.push({ id: marca + '-l' + i, tipo: 'saida', valor: 100 + i, descricao: 'Compra ' + i, categoria: 'Outros', data: '2026-11-' + String(1 + i % 16).padStart(2, '0'), contaId: marca + '-c6' });
    const dados = { contas: [{ id: marca + '-c6', nome: 'C6', tipo: 'Conta corrente', saldoInicial: 0 }], lancamentos: lanc };
    const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
    const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
    inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
  }), [quantos, marca]);
  await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(1500);
};
const ativosNaNuvem = () => page.evaluate(async () => {
  return (await window.__finanzTeste.tabela('lancamentos')).length;
});
const esperarNuvem = async (alvo, seg) => {
  let n = -1;
  for (let i = 0; i < seg; i++) { n = await ativosNaNuvem().catch(() => -1); if (n === alvo) break; await page.waitForTimeout(1000); }
  return n;
};

await restaurar(600);
conferir('1. os 600 lançamentos sobem para a nuvem', (await esperarNuvem(600, 60)) === 600);

// A rede tropeça no primeiro pedido de exclusão.
let patches = 0, derrubados = 0;
// Com a senha dos dados as exclusões vão para o cofre (cofre?id=in.(...)).
await page.route('**/rest/v1/cofre?id=in.*', async (route) => {
  if (route.request().method() !== 'PATCH') return route.continue();
  patches++;
  if (derrubados === 0) { derrubados++; return route.abort('failed'); }
  return route.continue();
});
await restaurar(100);
const depois = await esperarNuvem(100, 90);
conferir('2. trocando por 100, as 500 exclusões sobem mesmo com a rede caindo no meio', depois === 100, 'na nuvem: ' + depois);
conferir('3. em poucos pedidos, não um por lançamento', patches > 0 && patches <= 12 && derrubados === 1, patches + ' pedidos (1 derrubado)');
const aviso = await page.locator('#dialogoFundo.aberta:has-text("Não consegui")').count();
conferir('4. sem aviso de erro para a pessoa', aviso === 0);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

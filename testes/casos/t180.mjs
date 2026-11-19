// Dois pedidos do Vitor em 19/11/2026:
// 1) trocando a categoria de um lançamento, o app pergunta: só este, os de
//    mesmo nome deste extrato, ou todos com o mesmo nome (e os próximos);
// 2) na distribuição de gastos, tocar na categoria abre embaixo as
//    subcategorias, com nome e valor.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.clock.setFixedTime(new Date(2026, 10, 19, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('finanz.privado', '0'); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t180-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Três Pix para o mesmo posto: dois de uma importação, um de outra.
await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const conta = m + '-c6';
  const L = (id, valor, data, imp, cat, sub) => ({ id: m + id, tipo: 'saida', valor, descricao: 'Pix enviado para BARATAO COMBUSTIVEIS',
    categoria: cat, subcategoria: sub, data, contaId: conta, importacaoId: imp });
  const dados = { contas: [{ id: conta, nome: 'C6 Bank', tipo: 'Conta corrente', saldoInicial: 500000 }],
    importacoes: [{ id: m + 'i1', contaId: conta, banco: 'C6', arquivo: 'a.pdf', quando: Date.now(), quantos: 2, de: '2026-11-03', ate: '2026-11-05' },
                  { id: m + 'i2', contaId: conta, banco: 'C6', arquivo: 'b.pdf', quando: Date.now(), quantos: 1, de: '2026-11-10', ate: '2026-11-10' }],
    lancamentos: [L('a', 8583, '2026-11-03', m + 'i1', 'Outros', ''), L('b', 5000, '2026-11-05', m + 'i1', 'Outros', ''),
                  L('c', 7000, '2026-11-10', m + 'i2', 'Outros', ''),
                  { id: m + 'd', tipo: 'saida', valor: 3000, descricao: 'Estacionamento centro', categoria: 'Transporte', subcategoria: 'Estacionamento', data: '2026-11-06', contaId: conta }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);

const trocar = async (valorTexto, escolha, sub = 'Combustível') => {
  await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1000);
  await page.click('#telaTransacoes .linha:has-text("' + valorTexto + '")'); await page.waitForTimeout(1000);
  await page.click('#folha button:has-text("Transporte")'); await page.waitForTimeout(700);
  await page.click('#folha button:has-text("' + sub + '")').catch(() => {}); await page.waitForTimeout(500);
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(900);
  const lista = limpo(await page.textContent('#escolhaLista').catch(() => ''));
  if (escolha) { await page.click('#escolhaLista .escolha-item:has-text("' + escolha + '")'); await page.waitForTimeout(1500); }
  return lista;
};
const categorias = async () => {
  await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1000);
  return page.$$eval('#telaTransacoes .linha', ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()).filter(t => /BARATAO/.test(t)).map(t => /Combustível/.test(t) ? 'C' : /Estacionamento/.test(t) ? 'E' : 'O').join(''));
};

const op = await trocar('85,83', 'Só este');
console.log('opções:', op);
conferir('1. trocando a categoria, pergunta: só este, os deste extrato ou todos com o mesmo nome',
  /Só este lançamento/.test(op) && /deste extrato\s*2 lançamento\(s\) vão para Transporte · Combustível/.test(op) &&
  /Todos com o mesmo nome\s*3 lançamento\(s\)/.test(op), op.slice(0, 260));
await page.screenshot({ path: dir + '/z109-trocar-quais.png' }).catch(() => {});
const ord = (x) => x.split('').sort().join('');
conferir('2. "só este" muda só ele', ord(await categorias()) === 'COO', await categorias());

await trocar('50,00', 'deste extrato', 'Estacionamento');
const depoisLeva = await categorias();
conferir('3. "deste extrato" muda os dois da mesma importação e deixa o outro', ord(depoisLeva) === 'EEO', depoisLeva);

await trocar('70,00', 'Todos com o mesmo nome');
conferir('4. "todos com o mesmo nome" muda todos', (await categorias()) === 'CCC', await categorias());

// ---- distribuição: as subcategorias abrem embaixo ----
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
const gastos = page.locator('#telaInicio .cartao', { hasText: /Distribuição de gastos/ });
await gastos.locator('.legenda-alvo', { hasText: 'Transporte' }).first().click(); await page.waitForTimeout(600);
const sub = limpo(await gastos.locator('.legenda-sub:not([hidden])').first().textContent().catch(() => ''));
conferir('5. tocando em Transporte, abrem as subcategorias com nome e valor, sem sair da tela',
  /Combustível\s*R\$ 205,83/.test(sub) && /Estacionamento\s*R\$ 30,00/.test(sub) && !(await page.locator('#folha.aberta').count()), sub);
await gastos.screenshot({ path: dir + '/z110-subcategorias.png' });
await gastos.locator('.legenda-alvo', { hasText: 'Transporte' }).first().click(); await page.waitForTimeout(500);
conferir('6. tocando de novo, fecha', (await gastos.locator('.legenda-sub:not([hidden])').count()) === 0);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

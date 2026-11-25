// Pedido do Vitor em 25/11/2026: na conta nova, as boas-vindas explicam
// onde os dados ficam, como são protegidos e como o app lê os extratos, e
// avisam bem grande que sem dados o app não consegue estimar nada. No
// Início, um cartão grande lista o que falta preencher.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.clock.setFixedTime(new Date(2026, 10, 25, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('finanz.privado', '0'); localStorage.setItem('finanz.boasvindas.teste', '1'); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t193-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.waitForSelector('.boas-vindas', { timeout: 8000 }).catch(() => {});
const bv = page.locator('.boas-vindas');
conferir('1. conta nova: as boas-vindas abrem sozinhas', (await bv.count()) === 1);
const passo = async () => limpo(await bv.locator('.bv-passo').textContent().catch(() => ''));
const p1 = await passo();
conferir('2. primeiro: onde os dados ficam e quem vê', /Seus dados são seus/.test(p1) && /Só você vê os seus/.test(p1) && /AES de 256 bits/.test(p1), p1.slice(0, 160));
await page.screenshot({ path: dir + '/z133-boas-vindas-1.png' });
await bv.locator('button:has-text("Próximo")').click(); await page.waitForTimeout(300);
const p2 = await passo();
conferir('3. depois: como o app lê os extratos', /Como o app lê seus extratos/.test(p2) && /A leitura é feita aqui, no seu celular/.test(p2) && /nunca pede a senha do banco/.test(p2), p2.slice(0, 160));
await bv.locator('button:has-text("Próximo")').click(); await page.waitForTimeout(300);
const p3 = await passo();
conferir('4. o que nunca acontece', /Nada é vendido nem compartilhado/.test(p3) && /Sem rastreamento/.test(p3), p3.slice(0, 120));
await bv.locator('button:has-text("Próximo")').click(); await page.waitForTimeout(300);
const p4 = await passo();
conferir('5. por último, o aviso grande de preencher os dados', /Sem dados, o app não consegue te ajudar/.test(p4) && /Importe os extratos dos últimos 3 meses/.test(p4) &&
  (await bv.locator('.bv-alerta').count()) === 1, p4.slice(0, 160));
await page.screenshot({ path: dir + '/z134-boas-vindas-aviso.png' });
await bv.locator('button:has-text("Entendi, vamos começar")').click(); await page.waitForTimeout(800);
conferir('6. "Entendi" fecha', (await page.locator('.boas-vindas').count()) === 0);

// O cartão grande de Início, enquanto faltam dados.
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(800);
const fd = page.locator('#telaInicio .cartao-faltam-dados');
const fdTxt = limpo(await fd.textContent().catch(() => ''));
conferir('7. no Início, o cartão grande do que falta, em primeiro', /O app precisa dos seus dados/.test(fdTxt) && /0 de 4 feitos/.test(fdTxt) &&
  await page.evaluate(() => { const c = document.querySelector('#telaInicio .cartao'); return !!c && c.classList.contains('cartao-faltam-dados'); }), fdTxt.slice(0, 160));
await fd.screenshot({ path: dir + '/z135-faltam-dados.png' });

// Não abre de novo sozinha.
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(2500);
conferir('8. abrindo de novo, não aparece sozinha', (await page.locator('.boas-vindas').count()) === 0);

// Com 3 meses e extrato, o cartão some.
await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const L = (id, data) => ({ id: m + id, tipo: 'saida', valor: 1000, descricao: 'Compra ' + id, categoria: 'Outros', data, contaId: m + 'in', importacaoId: m + 'imp' });
  const dados = { contas: [{ id: m + 'in', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 }],
    importacoes: [{ id: m + 'imp', contaId: m + 'in', banco: 'Inter', arquivo: 'a.pdf', quando: Date.now(), quantos: 3, de: '2026-09-10', ate: '2026-11-10' }],
    lancamentos: [L('a', '2026-09-10'), L('b', '2026-10-10'), L('c', '2026-11-10')] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(1000);
conferir('9. com extrato e 3 meses de lançamentos, o cartão some', (await page.locator('#telaInicio .cartao-faltam-dados').count()) === 0);

// Em Mais, dá para reler.
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1000);
await page.click('#telaMais .linha:has-text("Como seus dados são protegidos")'); await page.waitForTimeout(600);
conferir('10. em Mais, "Como seus dados são protegidos" abre de novo', /Seus dados são seus/.test(await passo()));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

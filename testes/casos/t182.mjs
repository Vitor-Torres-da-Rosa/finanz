// Pedido do Vitor em 19/11/2026: um "i" no topo dos cartões, do lado do
// botão, explicando para que serve. Na primeira vez abre sozinho com o
// fundo fosco; depois, só tocando.
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t182-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const dados = { contas: [{ id: m + 'in', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 100000 }],
    lancamentos: [{ id: m + 'a', tipo: 'saida', valor: 5000, descricao: 'Mercado', categoria: 'Alimentação', subcategoria: 'Mercado', data: '2026-11-10', contaId: m + 'in' }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.evaluate(() => { document.querySelectorAll('.dica-fosco').forEach(n => n.click()); });
await page.waitForTimeout(800);

// Até aqui o teste não pede dica sozinha: nada cobriu a tela.
conferir('1. sem pedir, nos testes as dicas não abrem sozinhas', (await page.locator('.dica-pop').count()) === 0);

const contas = page.locator('#telaInicio .cartao', { has: page.locator('.linha-titulo', { hasText: 'Total em contas' }) });
const iContas = contas.locator('.cartao-topo .dica-i-botao');
const lado = await contas.locator('.cartao-topo-fim').evaluate(n => [...n.children].map(x => x.textContent.trim()).join('|')).catch(() => '');
conferir('2. o "i" fica do lado do "+ Nova"', lado === 'i|+ Nova', lado);

// Agora como gente: primeira vez em cada cartão, abre sozinho.
await page.evaluate(() => { localStorage.setItem('finanz.dicas.teste', '1'); Object.keys(localStorage).filter(k => /^finanz\.dica\./.test(k)).forEach(k => localStorage.removeItem(k)); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(2500);
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(400);
await page.evaluate(() => { window.scrollTo(0, 0); });
// A primeira que estiver inteira na tela abre sozinha.
let titulo1 = '';
for (let i = 0; i < 10 && !titulo1; i++) { await page.waitForTimeout(500); titulo1 = limpo(await page.locator('.dica-pop.visivel strong').textContent().catch(() => '')); }
conferir('3. a primeira dica que aparece na tela abre sozinha, com o fundo fosco', !!titulo1 && (await page.locator('.dica-fosco.visivel').count()) === 1, titulo1);
await page.mouse.click(20, 820); await page.waitForTimeout(1200);
// Rola até as contas: a dica delas abre sozinha.
await contas.locator('.cartao-topo').evaluate(n => n.scrollIntoView({ block: 'center' }));
let titulo2 = '';
for (let i = 0; i < 12 && titulo2 !== 'Contas'; i++) {
  await page.waitForTimeout(600);
  titulo2 = limpo(await page.locator('.dica-pop.visivel strong').textContent().catch(() => ''));
  if (titulo2 && titulo2 !== 'Contas') { await page.mouse.click(20, 820); await page.waitForTimeout(900); await contas.locator('.cartao-topo').evaluate(n => n.scrollIntoView({ block: 'center' })); }
}
const textoPop = limpo(await page.locator('.dica-pop.visivel').textContent().catch(() => ''));
conferir('4. chegando em Contas, a dica dela abre sozinha e explica a etiqueta dos dias', titulo2 === 'Contas' && /há quantos dias vai o último extrato/.test(textoPop), textoPop.slice(0, 140));
await page.screenshot({ path: dir + '/z112-dica-contas.png' });
await page.mouse.click(20, 820); await page.waitForTimeout(1200);
conferir('5. tocando fora, fecha', (await page.locator('.dica-pop').count()) === 0);

// Depois de vista, não abre mais sozinha.
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(2500);
await contas.locator('.cartao-topo').evaluate(n => n.scrollIntoView({ block: 'center' })); await page.waitForTimeout(2500);
const sozinha = limpo(await page.locator('.dica-pop.visivel strong').textContent().catch(() => ''));
conferir('6. já vista, a de Contas não abre mais sozinha', sozinha !== 'Contas', sozinha || '(nenhuma)');
if (sozinha) { await page.mouse.click(20, 820); await page.waitForTimeout(1200); }
await iContas.click(); await page.waitForTimeout(900);
conferir('7. tocando no "i", abre de novo', limpo(await page.locator('.dica-pop.visivel strong').textContent().catch(() => '')) === 'Contas');
await page.mouse.click(20, 820); await page.waitForTimeout(1200);

// Os outros cartões também têm.
const quantos = await page.locator('#telaInicio .cartao-topo .dica-i-botao').count();
conferir('8. outros cartões do Início também têm o "i"', quantos >= 2, quantos);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

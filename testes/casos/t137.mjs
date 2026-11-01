// Fatura do C6 cai no mês do vencimento, com o nome da loja.
//
// Pedido do Vitor em 01/11/2026: a fatura de vencimento 10/10 foi parar
// em janeiro de 2027. Dois erros juntos: o "10/12" de "Parcela 10/12" era
// lido como a data (e a descrição ia embora, virando "Entrada"), e o mês
// da fatura saía da compra mais recente em vez do vencimento impresso.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t137-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Cartão do C6 que fecha dia 3 e vence dia 10, como o do Vitor.
await page.evaluate(() => new Promise(res => {
  const dados = { contas:[{ id:'cartao', nome:'C6 Bank', tipo:'Cartão de crédito', saldoInicial:0,
                            banco:'c6', fechamento:3, vencimento:10, limite:1000000 }],
                  lancamentos:[] };
  const f = new File([JSON.stringify({app:'finanz', dados})], 'b.json', {type:'application/json'});
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);

page.on('filechooser', async fc => { await fc.setFiles(amostras + '/c6-fatura-parcelas.pdf'); });
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
await page.click('#telaMais .linha:has-text("Importar extrato")'); await page.waitForTimeout(3500);

const tela = limpo(await page.textContent('#folha'));
conferir('1. abre como fatura', /Conferir a fatura/.test(tela));
conferir('2. leu o vencimento do arquivo',
  (await page.inputValue('#folha input[type=date]')) === '2026-10-10',
  await page.inputValue('#folha input[type=date]'));
conferir('3. diz em qual fatura vai entrar', /Tudo entra na fatura de outubro de 2026, que vence em 10\/10\/2026/.test(tela),
  (tela.match(/Tudo entra[^.]*\./) || [''])[0]);
conferir('4. a loja aparece, não "Entrada"', /MERCADOLIVRE\*MERCADOL - Parcela 10\/12/.test(tela) && /HAVAN VIAMAO - Parcela 9\/10/.test(tela));
conferir('5. a data é a da compra, não a da parcela', /06\/12\/2025/.test(tela) && !/10\/12\/2026/.test(tela));
conferir('6. o pagamento da fatura anterior vem desmarcado', /Deixei desmarcado o pagamento/.test(tela));
conferir('7. marcados somam o valor da fatura', /6 de 7 lançamentos/.test(tela) && /Gastos R\$ 2\.562,34/.test(tela),
  (tela.match(/\d+ de \d+ lançamentos.{0,80}/) || [''])[0]);
await page.screenshot({ path: dir + '/z21-fatura-c6-conferir.png', fullPage: true });

await page.click('#folha .btn-ouro:has-text("Importar")'); await page.waitForTimeout(800);
await page.click('#dialogoAcoes button:has-text("Sim")'); await page.waitForTimeout(2500);
for (let i = 0; i < 3; i++) {
  if (!(await page.locator('#folha.aberta').count())) break;
  await page.goBack(); await page.waitForTimeout(700);
}

// No cartão: uma fatura só, a de outubro, com o valor impresso pelo banco.
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
const inicio = limpo(await page.textContent('#telaInicio'));
conferir('8a. o Início vai para outubro, o mês da fatura', /Outubro/.test(inicio) && !/06 dez a/.test(inicio),
  (inicio.match(/Domingo[^A-Z]*|[A-Z][a-zç]+ \d{4}|\d{2} [a-z]{3} a \d{2} [a-z]{3}|Outubro/) || [''])[0]);
conferir('8b. e as despesas do mês mostram a fatura', /Despesas\s*R\$ 2\.562,34/i.test(inicio),
  (inicio.match(/Despesas\s*R\$ [\d.,]+/i) || [''])[0]);
await page.click('#telaInicio .linha-alvo:has-text("C6 Bank")'); await page.waitForTimeout(1200);
const cartao = limpo(await page.textContent('#folha'));
const faturas = await page.$$eval('#folha .cartao', ns => {
  const f = ns.find(n => /Faturas/.test(n.textContent));
  return f ? [...f.querySelectorAll('.linha')].map(l => l.textContent.replace(/\s+/g, ' ').trim()) : [];
});
console.log('faturas:', faturas);
conferir('8. uma fatura só', faturas.length === 1, faturas.length);
conferir('9. é a de outubro de 2026', /outubro de 2026/.test(faturas[0] || ''));
conferir('10. com R$ 2.562,34 e 6 lançamentos', /6 lançamento\(s\)/.test(faturas[0] || '') && /2\.562,34/.test(faturas[0] || ''));
conferir('11. nada foi parar em janeiro', !/janeiro de 2027/.test(cartao));
await page.screenshot({ path: dir + '/z22-fatura-c6-no-cartao.png', fullPage: true });

// Importar de novo o mesmo arquivo: tudo já existe.
await page.goBack(); await page.waitForTimeout(800);
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
await page.click('#telaMais .linha:has-text("Importar extrato")'); await page.waitForTimeout(3500);
const deNovo = limpo(await page.textContent('#folha'));
conferir('12. reimportando, os 6 aparecem como já existentes', /6 lançamento\(s\) já existem/.test(deNovo),
  (deNovo.match(/\d+ lançamento\(s\) já existem/) || ['nada'])[0]);

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: a fatura cai no mês do vencimento');

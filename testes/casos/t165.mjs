// Contas de casa compartilhadas e divisão item por item (pedido do Vitor
// em 10/11/2026).
//
// - A pessoa que divide pode ter e-mail: quem tem o app recebe o convite e,
//   aceitando, vê e mexe nas mesmas contas e compras.
// - Tudo o que cada um lança ou muda leva o nome de quem fez.
// - Na compra, cada item é de quem participa: de um só, de alguns ou de
//   todos. Alguns dividem igual; "Ajustar" muda a % ou o valor de cada um,
//   e o resto se completa sozinho.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctxV = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const ctxA = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const vitor = await ctxV.newPage();
const ana = await ctxA.newPage();
for (const p of [vitor, ana]) p.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const suf = Date.now().toString(36) + process.pid;
const emailAna = 'ana-t165-' + suf + '@exemplo.com';
const dinheiro = async (page, loc, digitos) => {
  await loc.click(); for (let i = 0; i < 14; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(200);
};
async function criarConta(page, nome, email) {
  await page.clock.setFixedTime(new Date(2026, 10, 10, 9, 0, 0));
  await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
  await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
  const c = page.locator('.ent-campo input');
  await c.nth(0).fill(nome); await c.nth(1).fill(email); await c.nth(3).fill('senha123');
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3500);
}
async function sincronizar(page) { await page.evaluate(() => window.dispatchEvent(new Event('online'))); await page.waitForTimeout(5000); }
async function reabrir(page) { await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(6000); }
async function fechar(page) {
  for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
}
async function abrirCasa(page) {
  await fechar(page);
  const novo = page.locator('#telaInicio .cartao-casa button:has-text("+ Contas de casa")');
  if (await novo.count()) await novo.click(); else await page.click('#telaInicio .cartao-casa .cartao-acao:has-text("Abrir")');
  await page.waitForTimeout(900);
}

await criarConta(ana, 'Ana', emailAna);
await criarConta(vitor, 'Vitor', 'vitor-t165-' + suf + '@exemplo.com');

// ---- Vitor cadastra Ana (com e-mail) e João (sem) ----
await abrirCasa(vitor);
await vitor.click('#folha .cartao-acao:has-text("+ Pessoa")'); await vitor.waitForTimeout(800);
const formP = limpo(await vitor.textContent('#folha'));
conferir('1. a pessoa tem o campo de e-mail, com o convite explicado', /E-mail/.test(formP) && /recebe um convite para entrar nos cálculos/.test(formP));
await vitor.locator('#folha').getByLabel('Nome').fill('Ana');
await vitor.locator('#folha').getByLabel('E-mail').fill(emailAna);
await vitor.locator('#folha').getByLabel('Quanto entra nas contas (%)').fill('50');
await vitor.click('#folha .btn-ouro:has-text("Salvar")'); await vitor.waitForTimeout(2500);
await vitor.click('#folha .cartao-acao:has-text("+ Pessoa")'); await vitor.waitForTimeout(800);
await vitor.locator('#folha').getByLabel('Nome').fill('João');
await vitor.locator('#folha').getByLabel('Quanto entra nas contas (%)').fill('25');
await vitor.click('#folha .btn-ouro:has-text("Salvar")'); await vitor.waitForTimeout(1200);
const fv = limpo(await vitor.textContent('#folha'));
conferir('2. Ana aparece com o convite enviado', /Ana\s*50,0% padrão nas contas · convite enviado/.test(fv), fv.slice(0, 400));
await vitor.click('#folha .cartao-acao:has-text("+ Conta")'); await vitor.waitForTimeout(800);
await vitor.locator('#folha').getByLabel('Conta', { exact: true }).fill('Internet');
await dinheiro(vitor, vitor.locator('#folha').getByLabel('Valor por mês'), '10000');
await vitor.locator('#folha .seletor-quem .chip-quem:has-text("Ana")').click(); await vitor.waitForTimeout(200);
await vitor.click('#folha .btn-ouro:has-text("Salvar conta")'); await vitor.waitForTimeout(1000);
await fechar(vitor);
await sincronizar(vitor);

// ---- Ana recebe e aceita ----
await reabrir(ana);
const dialogo = limpo(await ana.textContent('#dialogoFundo').catch(() => ''));
conferir('3. Ana recebe o convite das Contas de casa', /Vitor quer compartilhar com você/.test(dialogo) && /Contas de casa/.test(dialogo), dialogo.slice(0, 120));
await ana.click('#dialogoAcoes button:has-text("Aceitar")'); await ana.waitForTimeout(7000);
await fechar(ana);
const cardA = limpo(await ana.textContent('#telaInicio .cartao-casa'));
conferir('4. aceitando, ela vê as contas do Vitor, com a parte dela', /Total por mês\s*R\$ 100,00/.test(cardA) && /Sua parte\s*R\$ 50,00/.test(cardA) && /Compartilhadas por Vitor/.test(cardA), cardA);
await abrirCasa(ana);
const fa = limpo(await ana.textContent('#folha'));
conferir('5. para ela, o Vitor é o dono e ela é "você"', /Vitor\s*fica com o que sobra · 25,0% padrão/.test(fa) && /Ana \(você\)\s*50,0% padrão/.test(fa) &&
  /Internet\s*Vitor 50,0% · Você 50,0% · por Vitor/.test(fa), fa.slice(0, 600));

// ---- Ana lança uma compra com três itens, cada um de um jeito ----
await ana.click('#folha .abas-casa button:has-text("Mercado")'); await ana.waitForTimeout(700);
await ana.click('#folha button:has-text("+ Compra sem foto")'); await ana.waitForTimeout(800);
const F = ana.locator('#folha');
await F.getByLabel('Onde').fill('Mercado do bairro');
// 1: arroz, Ana e João (Vitor fora): dividem igual.
await F.getByLabel('Item 1', { exact: true }).fill('Arroz');
await dinheiro(ana, F.getByLabel('Valor do item 1'), '3000');
await ana.click('#folha .item-quem[data-item="1"] .chip-quem:has-text("Vitor")'); await ana.waitForTimeout(200);
const div1 = limpo(await F.locator('.item-bloco').nth(0).locator('.item-divide').textContent());
conferir('6. escolhendo quem participa, os escolhidos dividem igual', /Ana R\$ 15,00 · João R\$ 15,00/.test(div1), div1);
// 2: shampoo, só da Ana.
await ana.click('#folha button:has-text("+ Item")'); await ana.waitForTimeout(300);
await F.getByLabel('Item 2', { exact: true }).fill('Shampoo');
await dinheiro(ana, F.getByLabel('Valor do item 2'), '2000');
await ana.click('#folha .item-quem[data-item="2"] .chip-quem:has-text("Vitor")'); await ana.waitForTimeout(200);
await ana.click('#folha .item-quem[data-item="2"] .chip-quem:has-text("João")'); await ana.waitForTimeout(200);
const div2 = limpo(await F.locator('.item-bloco').nth(1).locator('.item-divide').textContent());
conferir('7. um item só dela é individual', /só de Ana \(você\)/.test(div2), div2);
// 3: cerveja, Vitor e João; Vitor paga R$ 30 dos 40, e João completa.
await ana.click('#folha button:has-text("+ Item")'); await ana.waitForTimeout(300);
await F.getByLabel('Item 3', { exact: true }).fill('Cerveja');
await dinheiro(ana, F.getByLabel('Valor do item 3'), '4000');
await ana.click('#folha .item-quem[data-item="3"] .chip-quem:has-text("Você")'); await ana.waitForTimeout(200);
await ana.click('#folha [aria-label="Ajustar a divisão do item 3"]'); await ana.waitForTimeout(300);
await dinheiro(ana, F.getByLabel('Valor de Vitor no item 3'), '3000');
const pctJoao = await F.getByLabel('% de João no item 3').inputValue();
const pctVitor = await F.getByLabel('% de Vitor no item 3').inputValue();
conferir('8. pondo o valor, a % acompanha e o outro completa', pctVitor === '75,0' && pctJoao === '25,0', pctVitor + ' / ' + pctJoao);
const r = limpo(await F.locator('.total-calculado').textContent());
conferir('9. cada um paga a sua parte da compra', /Total da compra\s*R\$ 90,00/.test(r) && /Vitor paga\s*R\$ 30,00/.test(r) && /Você paga\s*R\$ 35,00/.test(r) && /João paga\s*R\$ 25,00/.test(r), r);
await ana.screenshot({ path: dir + '/z72-item-por-item.png', fullPage: true });
await ana.click('#folha .btn-ouro:has-text("Salvar compra")'); await ana.waitForTimeout(1200);
const fm = limpo(await ana.textContent('#folha'));
conferir('10. a compra fica com o nome de quem lançou', /Mercado do bairro\s*10\/11\/2026 · 3 item\(ns\) · por Ana\s*R\$ 90,00\s*sua parte R\$ 35,00/.test(fm), fm.slice(0, 400));
await fechar(ana);
await sincronizar(ana);

// ---- Vitor vê a compra da Ana e muda uma coisa ----
await reabrir(vitor);
await abrirCasa(vitor);
await vitor.click('#folha .abas-casa button:has-text("Mercado")'); await vitor.waitForTimeout(700);
const mv = limpo(await vitor.textContent('#folha'));
conferir('11. o Vitor vê a compra da Ana, com a parte dele', /Mercado do bairro\s*10\/11\/2026 · 3 item\(ns\) · por Ana\s*R\$ 90,00\s*sua parte R\$ 30,00/.test(mv) &&
  /Cada um no mês\s*Você\s*R\$ 30,00\s*Ana\s*R\$ 35,00\s*João\s*R\$ 25,00/.test(mv), mv.slice(0, 500));
await vitor.screenshot({ path: dir + '/z73-mercado-compartilhado.png' });
await vitor.click('#folha .linha:has-text("Mercado do bairro")'); await vitor.waitForTimeout(900);
await dinheiro(vitor, vitor.locator('#folha').getByLabel('Valor do item 1'), '3200');
await vitor.click('#folha .btn-ouro:has-text("Salvar compra")'); await vitor.waitForTimeout(1000);
await vitor.click('#folha .linha:has-text("Mercado do bairro")'); await vitor.waitForTimeout(900);
const autoria = limpo(await vitor.textContent('#folha .autoria'));
conferir('12. quem mudou também fica registrado', /Lançado por Ana em 10\/11\/2026 · alterado por Vitor em 10\/11\/2026/.test(autoria), autoria);
await fechar(vitor);
await sincronizar(vitor);

await reabrir(ana);
await abrirCasa(ana);
await ana.click('#folha .abas-casa button:has-text("Mercado")'); await ana.waitForTimeout(700);
const ma = limpo(await ana.textContent('#folha'));
conferir('13. a Ana vê a mudança do Vitor', /R\$ 92,00\s*sua parte R\$ 36,00/.test(ma), ma.slice(0, 300));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

// Contas de casa (pedido do Vitor em 09/11/2026).
//
// Na Visão geral, um cartão "Contas de casa": quem divide as contas da casa
// e com quanto cada um entra em cada conta. É só a base do cálculo: não
// entra nas despesas, que continuam sendo o que sai do extrato.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const dinheiro = async (loc, digitos) => {
  await loc.click(); for (let i = 0; i < 14; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(200);
};
const doServidor = async (ate) => {
  let linhas = [];
  for (let i = 0; i < 20; i++) {
    linhas = await page.evaluate(async () => {
      const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
      const cfg = window.FINANZ_CONFIG;
      const r = await fetch(cfg.supabaseUrl + '/rest/v1/empreendedor_registros?select=*', {
        headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
      return r.json();
    });
    linhas = (Array.isArray(linhas) ? linhas : []).filter(l => !l.excluido_em);
    if (ate(linhas)) return linhas;
    await page.waitForTimeout(1000);
  }
  return linhas;
};

await page.clock.setFixedTime(new Date(2026, 10, 9, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t163-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

const cartaoCasa = page.locator('#telaInicio .cartao-casa');
conferir('1. a Visão geral tem o cartão "Contas de casa"', await cartaoCasa.count() === 1 && /Contas de casa/.test(limpo(await cartaoCasa.textContent())));
await page.click('#telaInicio .cartao-casa button:has-text("+ Contas de casa")'); await page.waitForTimeout(900);
conferir('2. abre a folha das contas de casa', (await page.textContent('#folhaTitulo')) === 'Contas de casa');

// ---- Ana entra com 40% ----
await page.click('#folha .cartao-acao:has-text("+ Pessoa")'); await page.waitForTimeout(800);
await folha().getByLabel('Nome').fill('Ana');
await folha().getByLabel('Quanto entra nas contas (%)').fill('40');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(900);
const f1 = limpo(await folha().textContent());
conferir('3. volta para a folha com Ana e você', (await page.textContent('#folhaTitulo')) === 'Contas de casa' &&
  /Você\s*fica com o que sobra · 60,0% padrão/.test(f1) && /Ana\s*40,0% padrão nas contas/.test(f1), f1.slice(0, 300));

// ---- aluguel de R$ 2.000 pela divisão padrão ----
await page.click('#folha .cartao-acao:has-text("+ Conta")'); await page.waitForTimeout(800);
await folha().getByLabel('Conta', { exact: true }).fill('Aluguel');
await dinheiro(folha().getByLabel('Valor por mês'), '200000');
await folha().getByLabel('Vence no dia (opcional)').fill('10');
const prev = limpo(await folha().locator('.total-calculado').textContent());
conferir('4. a conta mostra quanto cada um paga', /Você · 60,0%\s*R\$ 1\.200,00/.test(prev) && /Ana · 40,0%\s*R\$ 800,00/.test(prev), prev);
await page.click('#folha .btn-ouro:has-text("Salvar conta")'); await page.waitForTimeout(900);

// ---- internet de R$ 100, meio a meio ----
await page.click('#folha .cartao-acao:has-text("+ Conta")'); await page.waitForTimeout(800);
await folha().getByLabel('Conta', { exact: true }).fill('Internet');
await dinheiro(folha().getByLabel('Valor por mês'), '10000');
await folha().getByLabel('Parte de Ana (%)').fill('50');
await page.waitForTimeout(200);
const prev2 = limpo(await folha().locator('.total-calculado').textContent());
conferir('5. dá para mudar a % de cada um na conta', /Você · 50,0%\s*R\$ 50,00/.test(prev2) && /Ana · 50,0%\s*R\$ 50,00/.test(prev2), prev2);
await page.click('#folha .btn-ouro:has-text("Salvar conta")'); await page.waitForTimeout(900);

const f2 = limpo(await folha().textContent());
conferir('6. o total e a sua parte', /Total das contas por mês\s*R\$ 2\.100,00/.test(f2) && /Sua parte: R\$ 1\.250,00/.test(f2), f2.slice(0, 200));
conferir('7. quanto cada pessoa paga por mês', /Você.*R\$ 1\.250,00\s*por mês/.test(f2) && /Ana\s*40,0% padrão nas contas\s*R\$ 850,00\s*por mês/.test(f2), f2.slice(0, 500));
conferir('8. cada conta com a divisão e a sua parte',
  /Aluguel\s*Você 60,0% · Ana 40,0% · vence dia 10\s*R\$ 2\.000,00\s*sua parte R\$ 1\.200,00/.test(f2) &&
  /Internet\s*Você 50,0% · Ana 50,0%\s*R\$ 100,00\s*sua parte R\$ 50,00/.test(f2), f2.slice(300, 800));
await page.screenshot({ path: dir + '/z67-contas-de-casa.png', fullPage: true });

for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
const cc = limpo(await cartaoCasa.textContent());
conferir('9. o cartão na Visão geral mostra o total e a sua parte',
  /Total por mês\s*R\$ 2\.100,00/.test(cc) && /Sua parte\s*R\$ 1\.250,00/.test(cc) && /Não entra nas despesas/.test(cc), cc);
const desp = limpo(await page.locator('#telaInicio .kpi:has-text("Despesas")').first().textContent());
conferir('10. e as despesas não mudam', /R\$ 0,00/.test(desp), desp);
await page.screenshot({ path: dir + '/z68-cartao-casa.png' });

const linhas = await doServidor(ls => ls.filter(l => /^casa_/.test(l.tipo)).length >= 3);
const tipos = linhas.filter(l => /^casa_/.test(l.tipo)).map(l => l.tipo).sort().join(',');
conferir('11. sobe para a nuvem', tipos === 'casa_conta,casa_conta,casa_membro', tipos);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

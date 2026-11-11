// Mudou uma parcela, o app pergunta se muda as próximas também (pedido do
// Vitor em 11/11/2026).
import { chromium, dir, ENDERECO, irParaClientes } from '../comum.mjs';
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
const parcelas = () => page.$$eval('#folha .lista-parcelas .linha', ns => ns.map(n => n.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()));
const venc = (l) => (l.match(/(\d\d\/\d\d\/\d{4})/) || [''])[0];

await page.clock.setFixedTime(new Date(2026, 10, 11, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t166-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await irParaClientes(page);
await page.click('#telaInicio .cartao-acao:has-text("+ Novo")'); await page.waitForTimeout(800);
await folha().locator('input.entrada[type=text]').first().fill('Diego');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .linha-alvo:has-text("Diego")'); await page.waitForTimeout(900);
await page.click('#folha button:has-text("+ Nova venda ou serviço")'); await page.waitForTimeout(900);
await dinheiro(folha().locator('.valor-grande'), '180000');
await folha().locator('input[placeholder="Ex.: Troca de embreagem"]').fill('Poco f5');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);
await page.click('#dialogoAcoes button:has-text("Combinar parcelas")'); await page.waitForTimeout(1300);
await page.click('#folha .campo:has-text("Em quantas vezes") .selecao'); await page.waitForTimeout(600);
await page.click('#escolhaLista .escolha-item:has-text("6x")'); await page.waitForTimeout(700);
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(1600);

let ls = await parcelas();
const antes = ls.map(venc);
console.log('antes:', antes.join(' '));

// ---- muda o dia da parcela 1 para 20: vale para todas ----
const v1 = antes[0].split('/').reverse().join('-');
const novo1 = v1.slice(0, 8) + '20';
await page.click('#folha .linha:has-text("Parcela 1 de 6")'); await page.waitForTimeout(800);
await folha().locator('.parcela-linha:has(.q:text-is("Vence em")) input').fill(novo1);
await page.click('#folha button:has-text("Salvar alterações")'); await page.waitForTimeout(700);
const esc = limpo(await page.textContent('#escolhaLista').catch(() => ''));
conferir('1. mudando a data, pergunta se muda as próximas', /Esta e as próximas\s*muda também as parcelas 2 a 6: vencendo todo dia 20/.test(esc) && /Só esta parcela/.test(esc), esc);
await page.screenshot({ path: dir + '/z75-mudar-proximas.png' });
await page.click('#escolhaLista .escolha-item:has-text("Esta e as próximas")'); await page.waitForTimeout(1200);
ls = await parcelas();
const depois = ls.map(venc);
console.log('depois:', depois.join(' '));
const esperado = antes.map((d, i) => {
  const [dd, mm, aa] = d.split('/').map(Number);
  const m0 = Number(antes[0].split('/')[1]) - 1, a0 = Number(antes[0].split('/')[2]);
  const t = new Date(a0, m0 + i, 20);
  return '20/' + String(t.getMonth() + 1).padStart(2, '0') + '/' + t.getFullYear();
});
conferir('2. "Esta e as próximas": as 6 passam a vencer no dia 20, um mês depois da outra', depois.length === 6 && depois.every((d, i) => d === esperado[i]), depois.join(' '));

// ---- muda só a parcela 2 para o dia 25 ----
await page.click('#folha .linha:has-text("Parcela 2 de 6")'); await page.waitForTimeout(800);
const v2 = depois[1].split('/').reverse().join('-');
await folha().locator('.parcela-linha:has(.q:text-is("Vence em")) input').fill(v2.slice(0, 8) + '25');
await page.click('#folha button:has-text("Salvar alterações")'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Só esta parcela")'); await page.waitForTimeout(1200);
const so = (await parcelas()).map(venc);
conferir('3. "Só esta parcela": só a 2 muda', so[1] === '25' + depois[1].slice(2) && so.slice(2).every((d, i) => d === depois[i + 2]) && so[0] === depois[0], so.join(' '));

// ---- valor novo para as próximas: o plano se ajusta ----
await page.click('#folha .linha:has-text("Parcela 3 de 6")'); await page.waitForTimeout(800);
await dinheiro(folha().locator('.valor-grande'), '40000');
await page.click('#folha button:has-text("Salvar alterações")'); await page.waitForTimeout(700);
const esc2 = limpo(await page.textContent('#escolhaLista').catch(() => ''));
conferir('4. mudando o valor, também pergunta', /muda também as parcelas 4 a 6: R\$ 400,00 cada/.test(esc2), esc2);
await page.click('#escolhaLista .escolha-item:has-text("Esta e as próximas")'); await page.waitForTimeout(1200);
const fv = limpo(await folha().textContent());
const lv = await parcelas();
conferir('5. as próximas ficam com o valor novo, as anteriores não mudam, e o total continua o da venda', /falta R\$ 1\.800,00/.test(fv) &&
  /Parcela 1 de 5.*R\$ 300,00/.test(lv[0] || '') && /Parcela 2 de 5.*R\$ 300,00/.test(lv[1] || '') &&
  /Parcela 3 de 5.*R\$ 400,00/.test(lv[2] || '') && /Parcela 4 de 5.*R\$ 400,00/.test(lv[3] || '') && /Parcela 5 de 5.*R\$ 400,00/.test(lv[4] || '') && lv.length === 5,
  JSON.stringify(lv));

// ---- sem mudar data nem valor, não pergunta ----
await page.click('#folha .linha:has-text("Parcela 1 de")'); await page.waitForTimeout(800);
await page.click('#folha button:has-text("Salvar alterações")'); await page.waitForTimeout(900);
conferir('6. sem mudar data nem valor, salva sem perguntar', !(await page.locator('#escolhaLista .escolha-item:has-text("Esta e as próximas")').isVisible().catch(() => false)) &&
  !(await page.locator('#folha.aberta .parcela-linha:has(.q:text-is("Vence em"))').count()));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

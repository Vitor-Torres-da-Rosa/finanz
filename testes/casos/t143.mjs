// Despesas de cada venda ou serviço.
//
// Pedido do Vitor em 02/11/2026: o registro não tinha onde pôr o que saiu
// do bolso, e o painel mostrava despesa zero e lucro igual ao faturamento.
// Exemplo: Poco F5 vendido por R$ 1.800,00, que custou R$ 1.500,00 mais
// uma capinha de R$ 30,00 — lucro de R$ 270,00.
import { chromium, dir, ENDERECO, irParaClientes } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const dinheiro = async (loc, digitos) => {
  await loc.click(); for (let i = 0; i < 12; i++) await loc.press('Backspace');
  await loc.type(digitos); await page.waitForTimeout(150);
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t143-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await irParaClientes(page);
await page.click('#telaInicio .cartao-acao:has-text("+ Novo")'); await page.waitForTimeout(800);
await folha().locator('input.entrada[type=text]').first().fill('Diego Schena');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .linha-alvo:has-text("Diego Schena")'); await page.waitForTimeout(900);
await page.click('#folha button:has-text("+ Nova venda ou serviço")'); await page.waitForTimeout(900);

await dinheiro(folha().locator('.valor-grande'), '180000');
await folha().locator('input[placeholder="Ex.: Troca de embreagem"]').fill('Poco f5');
conferir('1. o registro tem a parte de despesas', /Despesas/.test(limpo(await folha().textContent())) &&
  await folha().locator('button:has-text("+ Adicionar despesa")').count() === 1);

await page.click('#folha button:has-text("+ Adicionar despesa")'); await page.waitForTimeout(300);
await folha().getByLabel('Despesa 1', { exact: true }).fill('Custo do aparelho');
await dinheiro(folha().getByLabel('Valor da despesa 1'), '150000');
await page.click('#folha button:has-text("+ Adicionar despesa")'); await page.waitForTimeout(300);
await folha().getByLabel('Despesa 2', { exact: true }).fill('Capinha');
await dinheiro(folha().getByLabel('Valor da despesa 2'), '3000');
const prev = limpo(await folha().locator('.resumo-lucro').textContent());
conferir('2. o lucro aparece enquanto digita', /Total de despesas\s*R\$ 1\.530,00/.test(prev) && /Lucro\s*R\$ 270,00/.test(prev), prev);
await page.screenshot({ path: dir + '/z32-despesas-registro.png', fullPage: true });

await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Agora não")').catch(() => {}); await page.waitForTimeout(600);
const ficha = limpo(await folha().textContent());
conferir('3. a ficha do cliente mostra o lucro do registro', /Poco f5.*lucro R\$ 270,00/.test(ficha), (ficha.match(/Poco f5.{0,90}/) || [''])[0]);

// Abrindo de novo, as despesas estão lá; tirar uma recalcula.
await page.click('#folha .linha:has-text("Poco f5")'); await page.waitForTimeout(900);
conferir('4. as despesas ficaram guardadas',
  (await folha().getByLabel('Despesa 2', { exact: true }).inputValue()) === 'Capinha');
await page.click('#folha .despesa-tirar >> nth=1'); await page.waitForTimeout(300);
conferir('5. tirando a capinha, o lucro volta a R$ 300,00', /Lucro\s*R\$ 300,00/.test(limpo(await folha().locator('.resumo-lucro').textContent())));
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1200);
for (let i = 0; i < 3; i++) {
  if (!(await page.locator('#folha.aberta').count())) break;
  await page.goBack(); await page.waitForTimeout(600);
}

// ---- o resumo e o painel descontam ----
await page.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await page.waitForTimeout(800);
const resumo = limpo(await page.textContent('#telaInicio'));
conferir('6. o resumo de Serviços mostra despesas e lucro',
  /Despesas\s*R\$ 1\.500,00/.test(resumo) && /Lucro\s*R\$ 300,00/.test(resumo), (resumo.match(/Despesas.{0,40}/) || [''])[0]);
// 08/11/2026: os registros moram na linha "Serviços", que abre ao tocar.
await page.click('#telaInicio .sanfona-topo:has-text("Serviços")'); await page.waitForTimeout(500);
const abertos = limpo(await page.locator('#telaInicio .sanfona.aberta .sanfona-corpo').textContent());
conferir('7. e o registro na lista também', /Poco f5.*lucro R\$ 300,00/.test(abertos), abertos.slice(0, 120));
await page.click('#telaInicio .sanfona-topo:has-text("Serviços")'); await page.waitForTimeout(300);
await page.click('#telaInicio .modulo-voltar'); await page.waitForTimeout(700);
await page.click('#telaInicio .cartao-resumo-emp'); await page.waitForTimeout(900);
const painel = limpo(await page.textContent('#telaInicio .painel-modulo'));
conferir('8. o painel desconta as despesas de Serviços',
  /Faturamento\s*R\$ 1\.800,00/.test(painel) && /Despesas\s*R\$ 1\.500,00/.test(painel) && /Lucro\s*R\$ 300,00/.test(painel), painel.slice(0, 160));

// ---- sobe para o servidor e volta ----
let noServidor = null;
for (let i = 0; i < 20 && !noServidor; i++) {
  const linhas = await page.evaluate(async () => {
    const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
    const cfg = window.FINANZ_CONFIG;
    const r = await fetch(cfg.supabaseUrl + '/rest/v1/servicos?select=*', {
      headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
    return r.json();
  });
  noServidor = (linhas || []).find(l => l.nome === 'Poco f5' && Array.isArray(l.despesas) && l.despesas.length === 1) || null;
  if (!noServidor) await page.waitForTimeout(1000);
}
conferir('9. as despesas sobem com o registro', !!noServidor && noServidor.despesas[0].valor === 150000,
  noServidor ? JSON.stringify(noServidor.despesas) : 'não chegou');
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(3500);
await irParaClientes(page);
await page.click('#telaInicio .abas-modulo button:has-text("Registros")'); await page.waitForTimeout(800);
conferir('10. recarregando, o lucro continua certo', /Poco f5.*lucro R\$ 300,00/.test(limpo(await page.textContent('#telaInicio'))));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: despesas do registro');

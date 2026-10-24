// "Apagar tudo" tem que apagar tudo — e não encostar nas cópias.
//
// Pedido do Vitor em 24/10/2026: "se clicar nessa opção tem que apagar
// tudo que está no aplicativo mas os backups não são mexidos, se caso a
// pessoa quiser restaurar é só restaurar mas isso não deve funcionar de
// forma automática".
//
// Até a 5.16.1 esta opção não apagava nada numa conta com nuvem: esvaziava
// o aparelho, e a sincronização seguinte baixava tudo de volta em quatro
// segundos. O app dizia "Tudo apagado" e os dados reapareciam na tela.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');
const porDinheiro = async (loc, d) => {
  await loc.click();
  for (let i = 0; i < 16; i++) await loc.press('Backspace');
  await loc.type(d);
  await page.waitForTimeout(300);
};
const irParaInicio = async () => {
  for (let i = 0; i < 8; i++) {
    if (await page.locator('#telaInicio:visible').count()) return;
    await page.locator('#navegacao button').nth(1).click({ force: true }).catch(() => {});
    await page.waitForTimeout(300);
    await page.locator('#navegacao button').nth(0).click({ force: true }).catch(() => {});
    await page.waitForTimeout(600);
  }
};
const totalEmContas = async () => {
  await irParaInicio(); await page.waitForTimeout(800);
  if (!(await page.locator('#telaInicio:visible').count())) return '(não cheguei no Início)';
  const t = limpo(await page.textContent('#telaInicio'));
  const m = t.match(/Total em contas\s*(−?-?R\$ [\d.,]+)/);
  return m ? m[1].replace('−', '-') : '(não achei)';
};
// O que o SERVIDOR tem. A tela mostra o aparelho; o que interessa aqui é
// se o dado saiu da conta.
const naConta = async () => page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v3'));
  const cfg = window.FINANZ_CONFIG;
  const cab = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token };
  const pegar = async (t, q) => {
    const r = await fetch(cfg.supabaseUrl + '/rest/v1/' + t + '?' + q, { headers: cab });
    const j = await r.json();
    return Array.isArray(j) ? j : [];
  };
  return {
    lancamentos: (await pegar('lancamentos', 'select=id&excluido_em=is.null')).length,
    contas: (await pegar('contas', 'select=id&excluido_em=is.null')).length,
    copias: (await pegar('instantaneos', 'select=motivo')).map((i) => i.motivo)
  };
});

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t119-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await irParaInicio();
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1300);
await page.click('#fab'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '32000');
await folha().locator('input.entrada[type=text]').first().fill('Aluguel');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(4000);
conferir('1. o estado é −R$ 320,00 e está na conta',
  (await totalEmContas()) === '-R$ 320,00' && (await naConta()).lancamentos === 1);

// ---- apagar tudo ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
const linhaApagar = limpo(await page.textContent('#telaMais .linha:has-text("Apagar tudo")'));
conferir('2. a linha diz que apaga da conta, e que as cópias ficam',
  /da sua conta/.test(linhaApagar) && /cópias ficam/.test(linhaApagar), linhaApagar);

await page.click('#telaMais .linha:has-text("Apagar tudo")'); await page.waitForTimeout(900);
const aviso1 = limpo(await page.textContent('#dialogoTexto').catch(() => ''));
conferir('3. o primeiro aviso diz que some do servidor também',
  /servidor/.test(aviso1), aviso1.slice(0, 110));
await page.click('#dialogoAcoes button:has-text("Quero apagar")'); await page.waitForTimeout(1200);
const aviso2 = limpo(await page.textContent('#dialogoTexto').catch(() => ''));
conferir('4. o segundo avisa que as cópias não são apagadas',
  /cópias.*não são apagadas/.test(aviso2) && /nada volta sozinho/.test(aviso2),
  aviso2.slice(0, 160));
await page.screenshot({ path: dir+'/z12-apagar-tudo-aviso.png' });
await page.click('#dialogoAcoes button:has-text("Apagar tudo")');

await page.waitForSelector('#dialogoTitulo:text-is("Tudo apagado")', { timeout: 40000 }).catch(() => {});
const fim = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
conferir('5. o app confirma quando terminou de apagar dos dois lados',
  /Tudo apagado/.test(fim), fim);
await page.screenshot({ path: dir+'/z13-apagado.png' });
await page.click('#dialogoAcoes button').catch(() => {}); await page.waitForTimeout(1200);

// ---- a prova: não volta ----
await page.waitForTimeout(12000);
const depois = await naConta();
console.log('na conta depois:', JSON.stringify(depois));
conferir('6. os dados saíram da conta, não só do aparelho',
  depois.lancamentos === 0 && depois.contas === 0,
  depois.lancamentos + ' lançamento(s), ' + depois.contas + ' conta(s)');
conferir('7. e as cópias continuam lá, inclusive a de antes de apagar tudo',
  depois.copias.some((m) => /^antes de apagar tudo/.test(m)), JSON.stringify(depois.copias));

await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(9000);
await irParaInicio(); await page.waitForTimeout(800);
const naTela = limpo(await page.textContent('#telaInicio').catch(() => ''));
conferir('8. recarregando o app, nada voltou sozinho',
  naTela.indexOf('Banco Inter') < 0 && naTela.indexOf('320,00') < 0, naTela.slice(0, 120));
const aindaVazio = await naConta();
conferir('9. e a conta segue vazia', aindaVazio.lancamentos === 0, String(aindaVazio.lancamentos));

// ---- e volta SE a pessoa pedir ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
const naFolha = limpo(await page.textContent('#folha'));
conferir('10. a cópia de antes de apagar tudo está na lista',
  /Antes de apagar tudo/.test(naFolha), (naFolha.match(/Antes de apagar tudo[^›]*/) || ['(não achei)'])[0].slice(0, 80));
await page.click('#folha .linha:has-text("Antes de apagar tudo")'); await page.waitForTimeout(1200);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(14000);
if (await page.locator('#dialogoFundo.aberta').count()) {
  const bs = page.locator('#dialogoAcoes button');
  await bs.nth((await bs.count()) - 1).click(); await page.waitForTimeout(900);
}
const voltou = await totalEmContas();
conferir('11. pedindo, os dados voltam', voltou === '-R$ 320,00', voltou);
await page.screenshot({ path: dir+'/z14-restaurado-a-pedido.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: apaga dos dois lados, as cópias ficam, e só voltam quando a pessoa pede');

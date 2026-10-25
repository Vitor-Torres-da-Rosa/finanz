// Trazer um cofre cujos ids o servidor já conhece não pode morrer calado.
//
// Os ids são chave primária do banco inteiro, não de cada conta. Trazendo
// o cofre de outra conta do mesmo projeto, o upsert bate numa linha de
// outro dono e o RLS recusa:
//
//   400 POST /rest/v1/contas?on_conflict=id
//   new row violates row-level security policy (USING expression)
//
// O envio morria ali. Os dados ficavam só no aparelho, a nuvem seguia com
// o conjunto velho, e o app não dizia nada — quem limpasse o
// armazenamento do celular perdia tudo o que tinha trazido. É o caminho
// mais provável do sumiço que o Vitor levou ao reinstalar o app.
//
// Agora o cofre entra renumerado: as linhas viraram desta conta, então
// ganham ids desta conta.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('response', async (r) => {
  if (r.url().indexOf('/rest/v1/') < 0 || r.status() < 300) return;
  let b = ''; try { b = (await r.text()).slice(0, 150); } catch (e) { b = ''; }
  console.log('REDE ' + r.status() + ' ' + r.request().method() + ' ' + r.url().replace(/^.*\/rest/, '/rest') + ' :: ' + b);
});

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
const semDialogo = async (quando) => {
  if (!(await page.locator('#dialogoFundo.aberta').count())) return;
  const t = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
  console.log('diálogo ' + quando + ': "' + t + '" — fechando');
  const bs = page.locator('#dialogoAcoes button');
  await bs.nth((await bs.count()) - 1).click();
  await page.waitForTimeout(900);
};
const irParaInicio = async () => {
  for (let i = 0; i < 8; i++) {
    await semDialogo('a caminho do Início');
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
const noServidor = async () => page.evaluate(async () => {
  const pac = localStorage.getItem('caixa.nuvem.v4');
  if (!pac) return { erro: 'sem sessão' };
  const tok = JSON.parse(pac).access_token;
  const cfg = window.FINANZ_CONFIG;
  const pega = async (t) => (await (await fetch(cfg.supabaseUrl + '/rest/v1/' + t +
    '?select=*&excluido_em=is.null',
    { headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok } })).json());
  return { contas: (await pega('contas')).map((c) => c.nome).sort(),
           lancamentos: (await pega('lancamentos')).map((l) => l.descricao).sort() };
});

async function criarConta(marca) {
  await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
  const c = page.locator('.ent-campo input');
  await c.nth(0).fill('Vitor');
  await c.nth(1).fill(marca + '-' + Date.now() + '-' + process.pid + '@exemplo.com');
  await c.nth(3).fill('senha123');
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
}

async function porDinheiroNaConta(nome, reais, descricao) {
  await irParaInicio();
  await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(800);
  await folha().locator('input.entrada[type=text]').first().fill(nome);
  await page.click('#folha .btn-ouro'); await page.waitForTimeout(1200);
  await page.click('#fab'); await page.waitForTimeout(900);
  await porDinheiro(folha().locator('.valor-grande'), reais);
  await folha().locator('input.entrada[type=text]').first().fill(descricao);
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1600);
}

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);

// ---- conta A, com tudo subindo para a nuvem: é o que arma a colisão ----
await criarConta('t110a');
await porDinheiroNaConta('Banco Inter', '32000', 'Aluguel do Inter');
const saldoA = await totalEmContas();
conferir('1. a conta A fica com −R$ 320,00', saldoA === '-R$ 320,00', saldoA);
await page.waitForTimeout(7000);
const nuvemA = await noServidor();
conferir('2. e os ids dela passam a existir no banco',
  JSON.stringify(nuvemA.contas) === JSON.stringify(['Banco Inter']), JSON.stringify(nuvemA.contas));

// ---- sai, cria a conta B, que também tem dados próprios ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Sair da conta")'); await page.waitForTimeout(800);
await page.click('#dialogoAcoes button:has-text("Sair da conta")'); await page.waitForTimeout(3000);

await criarConta('t110b');
await page.waitForTimeout(2500);
await semDialogo('o convite de conta vazia');
await porDinheiroNaConta('C6 Bank', '55000', 'Besteira do C6');
await semDialogo('depois de lançar na B');
const saldoB = await totalEmContas();
conferir('3. a conta B fica com −R$ 550,00', saldoB === '-R$ 550,00', saldoB);
await page.waitForTimeout(7000);

// ---- trazer o cofre A para dentro da B ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Trazer dados de outra conta")'); await page.waitForTimeout(2500);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(12000);
const avisoRuim = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
conferir('4. não apareceu aviso de que não subiu', avisoRuim !== 'Trouxe, mas não subiu', avisoRuim || '(nenhum diálogo)');
await semDialogo('depois de trazer');
await page.screenshot({ path: dir+'/y01-depois-de-trazer.png', fullPage: true });

const naTela = await totalEmContas();
conferir('5. na tela sobrou só o cofre A: −R$ 320,00', naTela === '-R$ 320,00', naTela);

// O ponto do teste: isso tem de ter CHEGADO na nuvem.
const nuvemB = await noServidor();
console.log('NUVEM depois de trazer:', JSON.stringify(nuvemB));
conferir('6. e chegou na nuvem: só o Banco Inter',
  JSON.stringify(nuvemB.contas) === JSON.stringify(['Banco Inter']), JSON.stringify(nuvemB.contas));
conferir('7. com o lançamento dele junto',
  JSON.stringify(nuvemB.lancamentos) === JSON.stringify(['Aluguel do Inter']), JSON.stringify(nuvemB.lancamentos));

// Recarregar prova que não ficou só no aparelho.
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(9000);
await semDialogo('depois de recarregar');
const depois = await totalEmContas();
conferir('8. recarregando, a nuvem devolve o mesmo', depois === '-R$ 320,00', depois);
await page.screenshot({ path: dir+'/y02-depois-de-recarregar.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: cofre com ids conhecidos entra renumerado e chega na nuvem');

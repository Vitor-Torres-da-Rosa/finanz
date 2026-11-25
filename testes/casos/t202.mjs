// Compartilhado cifrado (pedido do Vitor em 25/11/2026): com a senha dos
// dados dos dois lados, a área compartilhada (Doces) vai cifrada com uma
// chave só dos dois. O servidor guarda texto embaralhado; os dois leem.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctxV = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const ctxE = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const vitor = await ctxV.newPage();
const esposa = await ctxE.newPage();
for (const p of [vitor, esposa]) p.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const suf = Date.now().toString(36) + process.pid;
const emailEsposa = 'esposa-t202-' + suf + '@exemplo.com';

async function criarConta(page, nome, email) {
  await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('finanz.cofre.auto', 'senha-do-cofre-123'); });
  await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
  await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
  const c = page.locator('.ent-campo input');
  await c.nth(0).fill(nome); await c.nth(1).fill(email); await c.nth(3).fill('senha123');
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3500);
}
async function irParaProdutos(page) {
  await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(600);
  await page.click('#telaInicio .segmentos button:has-text("Empreendedor")').catch(() => {}); await page.waitForTimeout(700);
  if (!(await page.locator('#telaInicio .modulo-cabecalho').count())) { await page.click('#telaInicio [data-modulo="doces"]'); await page.waitForTimeout(900); }
  await page.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await page.waitForTimeout(700);
}
async function novoProduto(page, nome) {
  await page.click('#telaInicio button:has-text("+ Novo produto")'); await page.waitForTimeout(800);
  await page.locator('#folha').getByLabel('Nome do doce').fill(nome);
  for (const [rot, dig] of [['Repasse para mim', '200']]) {
    const c = page.locator('#folha').getByLabel(rot, { exact: true });
    await c.click(); for (let i = 0; i < 10; i++) await c.press('Backspace'); await c.type(dig);
  }
  await page.click('#folha .btn-ouro:has-text("Salvar produto")'); await page.waitForTimeout(900);
}
async function sincronizar(page) {
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await page.waitForTimeout(5000);
}
async function reabrir(page) {
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(6000);
}


const linhasDoServidor = (page) => page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const h = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token };
  const reg = await (await fetch(cfg.supabaseUrl + '/rest/v1/empreendedor_registros?select=tipo,dados,user_id&excluido_em=is.null', { headers: h })).json();
  const conv = await (await fetch(cfg.supabaseUrl + '/rest/v1/compartilhamentos?select=*', { headers: h })).json();
  return { reg, conv };
});

// ---- as duas contas, cada uma com a senha dos dados ----
await criarConta(esposa, 'Daniela', emailEsposa);
await sincronizar(esposa);
await criarConta(vitor, 'Vitor', 'vitor-t202-' + suf + '@exemplo.com');
await sincronizar(vitor);
await vitor.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await vitor.waitForTimeout(800);
await vitor.click('#telaInicio [data-modulo="doces"]'); await vitor.waitForTimeout(900);
await vitor.click('#telaInicio .abas-modulo button:has-text("Produtos")'); await vitor.waitForTimeout(700);
await novoProduto(vitor, 'Brigadeiro do Vitor');
await sincronizar(vitor);

// ---- convite ----
await vitor.click('#telaInicio .abas-modulo button:has-text("Resumo")'); await vitor.waitForTimeout(800);
await vitor.click('#telaInicio button:has-text("+ Membro")'); await vitor.waitForTimeout(800);
await vitor.locator('#folha').getByLabel('Nome').fill('Daniela');
await vitor.locator('#folha').getByLabel('E-mail').fill(emailEsposa);
await vitor.locator('#folha').getByLabel('Parte do lucro (%)').fill('50');
await vitor.click('#folha .btn-ouro:has-text("Salvar membro")'); await vitor.waitForTimeout(2500);
for (let i = 0; i < 3 && await vitor.locator('#folha.aberta').count(); i++) { await vitor.goBack(); await vitor.waitForTimeout(600); }
await sincronizar(vitor);

// ---- ela aceita; a chave pública dela vai no convite ----
await reabrir(esposa);
await esposa.click('#dialogoAcoes button:has-text("Aceitar")'); await esposa.waitForTimeout(7000);
await sincronizar(esposa);
// ele abre o app: embrulha a chave da área para ela
await reabrir(vitor);
await sincronizar(vitor);
// ela abre: desembrulha e lê
await reabrir(esposa);
await sincronizar(esposa);
await irParaProdutos(esposa);
let telaE = limpo(await esposa.textContent('#telaInicio'));
conferir('1. ela vê os doces dele, abertos pela chave da área', /Brigadeiro do Vitor/.test(telaE), telaE.slice(0, 160));
await esposa.screenshot({ path: dir + '/z202-esposa.png' });

const s1 = await linhasDoServidor(vitor);
const doces = s1.reg.filter(r => r.tipo === 'doce_produto');
const conv = s1.conv[0] || {};
console.log('no servidor:', doces.length, 'produto(s) |', JSON.stringify(doces.map(d => Object.keys(d.dados))));
conferir('2. no servidor, os doces da área compartilhada estão cifrados (nada à vista)', doces.length >= 1 &&
  doces.every(d => d.dados && typeof d.dados.c === 'string' && Object.keys(d.dados).length === 1) && !/Brigadeiro/.test(JSON.stringify(s1.reg)), JSON.stringify(doces).slice(0, 160));
conferir('3. o convite tem as duas chaves públicas e a chave da área embrulhada para ela',
  !!conv.dono_chave_publica && !!conv.convidado_chave_publica && conv.chaves && typeof conv.chaves.doces === 'string', Object.keys(conv).join(','));

// ---- ela cadastra; ele vê ----
await novoProduto(esposa, 'Beijinho da esposa');
await sincronizar(esposa);
const s2 = await linhasDoServidor(esposa);
conferir('4. o que ela cadastra também sobe cifrado', !/Beijinho/.test(JSON.stringify(s2.reg)) && s2.reg.filter(r => r.tipo === 'doce_produto').length >= 2);
await reabrir(vitor);
await irParaProdutos(vitor);
const telaV = limpo(await vitor.textContent('#telaInicio'));
conferir('5. e ele vê o que ela cadastrou', /Beijinho da esposa/.test(telaV) && /Brigadeiro do Vitor/.test(telaV), telaV.slice(0, 200));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

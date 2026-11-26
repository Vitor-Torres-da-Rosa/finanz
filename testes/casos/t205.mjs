// Sem a senha dos dados, nada sincroniza (pedido do Vitor em 26/11/2026).
// O servidor recusa dado aberto (migração 25): as tabelas antigas ficam
// fechadas — uma versão antiga recebe "proibido", não "vazio", e por isso
// não troca os dados do celular pelo vazio. Com a senha, tudo sobe cifrado.
import { chromium, dir, ENDERECO } from '../comum.mjs';
import pg from 'pg';
const db = new pg.Client({ host: '/tmp', port: 55433, user: 'postgres', database: 'caixa_app' });
await db.connect();
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const nuvem = (metodo, caminho, corpo) => page.evaluate(async ({ metodo, caminho, corpo }) => {
  const tok = JSON.parse(localStorage.getItem('caixa.nuvem.v4')).access_token;
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + caminho, { method: metodo, body: corpo ? JSON.stringify(corpo) : undefined,
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Prefer: 'return=minimal' } });
  return { status: r.status, corpo: await r.text() };
}, { metodo, caminho, corpo });

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const email = 't205-' + Date.now() + '-' + process.pid + '@exemplo.com';
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill(email); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);
const uid = (await db.query('select id from auth.users where email = $1', [email])).rows[0].id;

// lança uma conta e espera a sincronia tentar
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
await page.locator('#folha input.entrada[type=text]').first().fill('Banco Secreto');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(7000);
const noCofre = Number((await db.query('select count(*) from public.cofre where user_id = $1', [uid])).rows[0].count);
const perfil = (await db.query('select nome from public.perfis where id = $1', [uid])).rows[0];
conferir('1. sem a senha dos dados, nada do que eu lanço vai para o servidor', noCofre === 0 && (!perfil || perfil.nome === ''), noCofre + ' ' + JSON.stringify(perfil));

await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
const linha = limpo(await page.textContent('#telaMais .botao-sincronia-desligada').catch(() => ''));
conferir('2. em Mais, a sincronização aparece desligada e explica', /Sincronização desligada/.test(linha) && /só neste celular/.test(linha), linha);
await page.locator('#telaMais .botao-sincronia-desligada').screenshot({ path: dir + '/z205-desligada.png' }).catch(() => {});

// uma versão antiga do app: o servidor recusa, não devolve vazio
const ler = await nuvem('GET', '/rest/v1/lancamentos?select=id');
const gravar = await nuvem('POST', '/rest/v1/contas', [{ id: 'velho1', user_id: uid, nome: 'Aberta', tipo: 'Conta corrente', saldo_inicial: 0 }]);
conferir('3. versão antiga lendo ou gravando nas tabelas antigas: o servidor recusa (403), não devolve vazio', ler.status === 403 && gravar.status === 403, ler.status + '/' + gravar.status);
const reg = await nuvem('POST', '/rest/v1/empreendedor_registros', [{ id: 'reg1', user_id: uid, tipo: 'doce_venda', dados: { valor: 10 } }]);
const arq = await nuvem('POST', '/rest/v1/arquivos_extrato', [{ id: 'arq1', user_id: uid, nome: 'a.pdf', tipo: 'application/pdf', tamanho: 3, conteudo: 'JVBERi0=' }]);
conferir('4. registro do Empreendedor e arquivo de extrato sem cifra: recusados', reg.status >= 400 && arq.status >= 400, reg.status + '/' + arq.status);
await nuvem('PATCH', '/rest/v1/perfis?id=eq.' + uid, { nome: 'Nome Aberto', negocio: 'Negócio Aberto' });
const perfil2 = (await db.query('select nome, negocio from public.perfis where id = $1', [uid])).rows[0];
conferir('5. perfil aberto gravado por versão antiga: o servidor deixa em branco', !perfil2 || (perfil2.nome === '' && perfil2.negocio === ''), JSON.stringify(perfil2));

// ligar: cria a senha e tudo sobe cifrado
await page.click('#telaMais .botao-sincronia-desligada'); await page.waitForTimeout(600);
const pergunta = limpo(await page.textContent('#dialogoFundo').catch(() => ''));
conferir('6. tocando, oferece criar a senha para ligar', /Ligar a sincronização\?/.test(pergunta) && /só neste celular/.test(pergunta), pergunta.slice(0, 120));
await page.click('#dialogoAcoes button:has-text("Criar a senha")'); await page.waitForTimeout(900);
await page.fill('#folha .campo-senha-dados', 'segredo-205');
await page.fill('#folha .campo-senha-dados2', 'segredo-205');
await page.click('#folha .botao-criar-cofre');
await page.waitForFunction(() => /Seus dados estão cifrados/.test((document.querySelector('#dialogoFundo.aberta') || {}).textContent || ''), null, { timeout: 60000 }).catch(() => {});
await page.click('#dialogoAcoes button').catch(() => {}); await page.waitForTimeout(500);
let linhas = 0;
for (let i = 0; i < 30 && !linhas; i++) {
  linhas = Number((await db.query("select count(*) from public.cofre where user_id = $1 and tabela = 'contas'", [uid])).rows[0].count);
  if (!linhas) await page.waitForTimeout(1000);
}
const bruto = (await db.query('select dados from public.cofre where user_id = $1', [uid])).rows.map(r => r.dados).join(' ');
conferir('7. com a senha criada, a conta sobe cifrada (sem o nome à vista)', linhas >= 1 && !/Banco Secreto/.test(bruto), linhas + ' linha(s)');
for (let i = 0; i < 4 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(500); }
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(500);
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
conferir('8. e a linha volta a ser "Sincronizar agora"', await page.locator('#telaMais .botao-sincronia-desligada').count() === 0 &&
  await page.locator('#telaMais .linha:has-text("Sincronizar agora")').count() === 1);

await db.end();
console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

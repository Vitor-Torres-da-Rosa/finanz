// Criptografia de ponta a ponta (pedido do Vitor em 25/11/2026): com a
// "senha dos dados", tudo vai para a nuvem cifrado; o que estava aberto é
// convertido e só então apagado; outro aparelho pede a senha uma vez; e
// "Esqueci a senha" apaga a nuvem para recomeçar.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
const email = 't198-' + Date.now() + '-' + process.pid + '@exemplo.com';
const SENHA_DADOS = 'cofre-forte-123';

const novaPagina = async () => {
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(ENDERECO, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); localStorage.setItem('finanz.cofre.teste', '1'); sessionStorage.setItem('finanz.privado', '0'); });
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1600);
  return page;
};
const nuvem = (page, metodo, caminho, corpo) => page.evaluate(async ({ metodo, caminho, corpo }) => {
  const tok = JSON.parse(localStorage.getItem('caixa.nuvem.v4')).access_token;
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + caminho, { method: metodo, body: corpo ? JSON.stringify(corpo) : undefined,
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Prefer: 'return=minimal' } });
  return r.status === 204 || r.status === 201 ? [] : r.json().catch(() => []);
}, { metodo, caminho, corpo });

// ---- aparelho 1: conta nova ----
const p1 = await novaPagina();
await p1.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await p1.click('.btn-dourado:has-text("Criar minha conta")'); await p1.waitForTimeout(500);
const c = p1.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill(email); await c.nth(3).fill('senha123');
await p1.click('.btn-dourado:has-text("Continuar")'); await p1.waitForTimeout(400);
await p1.click('.btn-dourado:has-text("Continuar")'); await p1.waitForTimeout(400);
await p1.click('.btn-dourado:has-text("Criar minha conta")');
await p1.waitForSelector('#folha .botao-criar-cofre', { timeout: 30000 }).catch(() => {});
conferir('1. conta sem cofre: o app pede para criar a senha dos dados', await p1.locator('#folha .botao-criar-cofre').count() === 1);
await p1.screenshot({ path: dir + '/z198-criar-cofre.png' });
await p1.click('#folha .btn-fantasma:has-text("Agora não")'); await p1.waitForTimeout(800);

// dados abertos, do jeito antigo
await p1.evaluate(() => new Promise(res => {
  const m = 'x' + Math.random().toString(36).slice(2, 7);
  const L = (id, data, desc, v) => ({ id: m + id, tipo: 'saida', valor: v, descricao: desc, categoria: 'Alimentação', data, contaId: m + 'in' });
  const dados = { contas: [{ id: m + 'in', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 500000 }],
    lancamentos: [L('a', '2026-11-10', 'Mercado Segredo', 12345), L('b', '2026-11-11', 'Padaria Secreta', 2300), L('c', '2026-11-12', 'Farmácia Oculta', 4500)],
    metas: [{ id: m + 'mt', nome: 'Viagem Confidencial', alvo: 900000, guardado: 100000, prazo: '2027-06-01' }],
    orcamentos: { geral: 300000, categorias: { 'Alimentação': 100000 } } };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await p1.click('#dialogoAcoes button:has-text("Restaurar")'); await p1.waitForTimeout(6000);
let abertos = await nuvem(p1, 'GET', '/rest/v1/lancamentos?select=id,descricao&excluido_em=is.null');
conferir('2. antes do cofre, os lançamentos estão abertos no servidor (o jeito antigo)', abertos.length === 3 && abertos.some(x => /Mercado Segredo/.test(x.descricao)), abertos.length);

// ---- cria a senha dos dados em Mais ----
await p1.click('#navegacao button:has-text("Mais")'); await p1.waitForTimeout(900);
const linhaMais = limpo(await p1.textContent('#telaMais .linha:has-text("Senha dos dados")'));
conferir('3. em Mais, "Senha dos dados" convida a proteger', /Proteja seus dados com uma senha/.test(linhaMais), linhaMais);
await p1.click('#telaMais .linha:has-text("Senha dos dados")'); await p1.waitForTimeout(700);
await p1.fill('#folha .campo-senha-dados', SENHA_DADOS);
await p1.fill('#folha .campo-senha-dados2', 'outra-coisa-99');
await p1.click('#folha .botao-criar-cofre'); await p1.waitForTimeout(300);
conferir('4. as duas senhas precisam ser iguais', /não são iguais/.test(limpo(await p1.textContent('#folha'))));
await p1.fill('#folha .campo-senha-dados2', SENHA_DADOS);
await p1.click('#folha .botao-criar-cofre');
await p1.waitForFunction(() => /Seus dados estão cifrados/.test((document.querySelector('#dialogoFundo.aberta') || {}).textContent || ''), null, { timeout: 60000 }).catch(() => {});
conferir('5. criada: o app avisa que tudo está cifrado', /Seus dados estão cifrados/.test(limpo(await p1.textContent('#dialogoFundo').catch(() => ''))));
await p1.screenshot({ path: dir + '/z198-cifrado.png' });
await p1.click('#dialogoAcoes button').catch(() => {}); await p1.waitForTimeout(500);

// a conversão roda depois da sincronia: espera as linhas abertas sumirem
for (let i = 0; i < 30; i++) {
  abertos = await nuvem(p1, 'GET', '/rest/v1/lancamentos?select=id');
  if (!abertos.length) break;
  await p1.waitForTimeout(1000);
}
const cofreLinhas = await nuvem(p1, 'GET', '/rest/v1/cofre?select=id,tabela,dados,excluido_em');
const perfil = (await nuvem(p1, 'GET', '/rest/v1/perfis?select=*'))[0] || {};
const contasAbertas = await nuvem(p1, 'GET', '/rest/v1/contas?select=id');
const metasAbertas = await nuvem(p1, 'GET', '/rest/v1/metas?select=id');
const orcAbertos = await nuvem(p1, 'GET', '/rest/v1/orcamentos?select=categoria');
const tabelas = [...new Set(cofreLinhas.map(x => x.tabela))].sort().join(',');
const tudo = JSON.stringify(cofreLinhas);
console.log('no cofre:', cofreLinhas.length, 'linhas |', tabelas);
conferir('6. no servidor: nada aberto nas tabelas antigas', !abertos.length && !contasAbertas.length && !metasAbertas.length && !orcAbertos.length,
  [abertos.length, contasAbertas.length, metasAbertas.length, orcAbertos.length].join('/'));
conferir('7. no cofre: tudo, e ilegível (nem descrição, nem nome, nem valor)', cofreLinhas.filter(x => x.tabela === 'lancamentos' && !x.excluido_em).length === 3 &&
  /contas/.test(tabelas) && /metas/.test(tabelas) && /perfis/.test(tabelas) && /orcamentos/.test(tabelas) &&
  !/Mercado|Segredo|Padaria|Inter|Viagem|Confidencial|12345|Vitor/.test(tudo), tabelas);
conferir('8. o perfil aberto ficou no padrão, e a chave só embrulhada', !perfil.nome && perfil.cofre && perfil.cofre.kdf && perfil.cofre.kdf.voltas >= 100000 &&
  perfil.cofre.chave && perfil.cofre.convertido && !/Vitor/.test(JSON.stringify(perfil)), JSON.stringify(perfil.cofre || {}).slice(0, 120));
await p1.reload({ waitUntil: 'networkidle' }); await p1.waitForTimeout(5000);
await p1.click('#navegacao button:has-text("Transações")'); await p1.waitForTimeout(1200);
const tr1 = limpo(await p1.textContent('#telaTransacoes'));
conferir('9. no próprio aparelho, nada muda: tudo continua à vista, sem pedir senha', /Mercado Segredo/.test(tr1) && !(await p1.locator('#folha .campo-senha-dados').count()), tr1.slice(0, 80));

// ---- aparelho 2: entra e pede a senha uma vez ----
const p2 = await novaPagina();
await p2.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await p2.click('.btn-contorno:has-text("Entrar na minha conta")'); await p2.waitForTimeout(1200);
const campos = p2.locator('.ent-campo input');
await campos.nth(0).fill(email); await campos.nth(1).fill('senha123');
await p2.click('.btn-dourado:has-text("Entrar")');
await p2.waitForSelector('#folha .botao-abrir-cofre', { timeout: 30000 }).catch(() => {});
conferir('10. outro aparelho: pede a senha dos dados', await p2.locator('#folha .botao-abrir-cofre').count() === 1);
await p2.screenshot({ path: dir + '/z198-senha-outro-aparelho.png' });
await p2.fill('#folha .campo-senha-dados', 'errada-errada');
await p2.click('#folha .botao-abrir-cofre');
await p2.waitForFunction(() => /Senha errada/.test((document.querySelector('#folha') || {}).textContent || ''), null, { timeout: 20000 }).catch(() => {});
conferir('11. senha errada não abre', /Senha errada/.test(limpo(await p2.textContent('#folha'))));
await p2.fill('#folha .campo-senha-dados', SENHA_DADOS);
await p2.click('#folha .botao-abrir-cofre'); await p2.waitForTimeout(8000);
await p2.click('#navegacao button:has-text("Transações")'); await p2.waitForTimeout(1500);
const tr2 = limpo(await p2.textContent('#telaTransacoes'));
conferir('12. com a senha certa, os dados descem e abrem', /Mercado Segredo/.test(tr2) && /Padaria Secreta/.test(tr2), tr2.slice(0, 120));
await p2.click('#navegacao button:has-text("Planejar")'); await p2.waitForTimeout(1200);
conferir('13. metas e orçamento também', /Viagem Confidencial/.test(limpo(await p2.textContent('#telaPlanejamento'))));
await p2.click('#navegacao button:has-text("Mais")'); await p2.waitForTimeout(900);
conferir('14. em Mais, a senha aparece ligada', /Ligada: seus dados sobem cifrados/.test(limpo(await p2.textContent('#telaMais .linha:has-text("Senha dos dados")'))));
// recarregando, não pede de novo
await p2.reload({ waitUntil: 'networkidle' }); await p2.waitForTimeout(6000);
conferir('15. recarregando, não pede de novo', !(await p2.locator('#folha .botao-abrir-cofre').count()));

// ---- aparelho 3: esqueceu a senha ----
const p3 = await novaPagina();
await p3.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await p3.click('.btn-contorno:has-text("Entrar na minha conta")'); await p3.waitForTimeout(1200);
const campos3 = p3.locator('.ent-campo input');
await campos3.nth(0).fill(email); await campos3.nth(1).fill('senha123');
await p3.click('.btn-dourado:has-text("Entrar")');
await p3.waitForSelector('#folha .botao-esqueci-cofre', { timeout: 30000 });
await p3.click('#folha .botao-esqueci-cofre');
await p3.waitForSelector('#dialogoFundo.aberta'); await p3.waitForTimeout(400);
const aviso = limpo(await p3.textContent('#dialogoFundo'));
conferir('16. "Esqueci a senha" explica que não tem volta e deixa escolher', /não abrem mais/.test(aviso) && /Deixar como está/.test(aviso), aviso.slice(0, 120));
await p3.click('#dialogoAcoes button:has-text("Apagar a nuvem")'); await p3.waitForTimeout(700);
await p3.click('#dialogoAcoes button:has-text("Apagar de vez")');
await p3.waitForSelector('#folha .botao-criar-cofre', { timeout: 30000 }).catch(() => {});
const depois = await nuvem(p3, 'GET', '/rest/v1/cofre?select=id');
const perfil3 = (await nuvem(p3, 'GET', '/rest/v1/perfis?select=cofre'))[0] || {};
conferir('17. apagado: o cofre some da nuvem e o app pede uma senha nova', !depois.length && !perfil3.cofre &&
  await p3.locator('#folha .botao-criar-cofre').count() === 1, depois.length);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

// O teto de mil linhas, e o download que não sabia dele.
//
// Vitor, 26/10/2026: "Olha ai veio da nuvem e modificou tudo". Quatro
// prints, e o Histórico do saldo entregando o padrão: TODA linha "Veio da
// nuvem" marcava exatamente 1000 lançamentos, e toda volta no tempo
// marcava 3520. Mil não era a conta dele — era o teto.
//
// O Supabase corta toda resposta em 1000 linhas ("Max rows", e vale para
// qualquer projeto novo) e corta calado: 200, com as mil primeiras, como
// se fossem a tabela inteira. E o download não acrescenta nada ao que já
// está aqui: ele monta o estado do zero com o que chegou. Então o saldo
// dele virava o saldo de mil lançamentos.
//
// Pior: o select não pedia ordem nenhuma. Sem ordem o banco escolhe quais
// mil manda, e nada o obriga a escolher as mesmas de novo — por isso o
// saldo mudava sozinho a cada sincronização, com ele olhando a tela e sem
// ter mexido em nada.
//
// Aqui o emulador corta em 1000 igual ao Supabase, e a verificação 2 prova
// o corte antes de cobrar qualquer coisa do app: sem o teto de pé, este
// teste ficaria verde para sempre com o defeito inteiro no lugar.
import { chromium, dir, ENDERECO } from '../comum.mjs';

// Tem que passar de 1000 com folga, e sem fazer a suíte esperar.
const SEMEADOS = 1100;
const TETO = 1000;

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
const semDialogo = async () => {
  if (!(await page.locator('#dialogoFundo.aberta').count())) return '';
  const t = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
  const bs = page.locator('#dialogoAcoes button');
  await bs.nth((await bs.count()) - 1).click();
  await page.waitForTimeout(900);
  return t;
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

// ---- a conta, uma conta bancária e um lançamento de R$ 320,00 ----
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const email = 't129-' + Date.now() + '-' + process.pid + '@exemplo.com';
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill(email); await c.nth(3).fill('senha123');
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
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1600);
conferir('1. começo em −R$ 320,00', (await totalEmContas()) === '-R$ 320,00');

// Sobe o que acabei de criar: a semeadura precisa do id da conta que
// está no servidor, e é nela que os 1100 lançamentos vão pendurados.
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Sincronizar agora")'); await page.waitForTimeout(6000);
await semDialogo();

// ---- 1100 lançamentos de um centavo, direto no servidor ----
//
// Pela API e não pela tela de propósito: o que está em teste é a LEITURA
// de uma tabela grande, não o caminho que a encheu. Um centavo cada para
// a conta final ser uma só e óbvia: 32000 + 1100 = 33100 centavos.
const semeadura = await page.evaluate(async (quantos) => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const cab = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token,
                'Content-Type': 'application/json', Prefer: 'return=minimal' };
  const contas = await (await fetch(cfg.supabaseUrl + '/rest/v1/contas?select=id', { headers: cab })).json();
  const contaId = contas[0].id;
  const hoje = new Date().toISOString().slice(0, 10);
  const linhas = [];
  const marca = pac.usuario.id.slice(0, 8);
  for (let i = 0; i < quantos; i++) {
    linhas.push({ id: 'sem-' + marca + '-' + String(i).padStart(5, '0'), user_id: pac.usuario.id,
      tipo: 'saida', valor: 1, descricao: 'Centavo ' + i, categoria: 'Outros',
      data: hoje, conta_id: contaId });
  }
  const estados = [];
  for (let i = 0; i < linhas.length; i += 275) {
    const r = await fetch(cfg.supabaseUrl + '/rest/v1/lancamentos', {
      method: 'POST', headers: cab, body: JSON.stringify(linhas.slice(i, i + 275)) });
    estados.push(r.status);
  }
  return estados.join(' ');
}, SEMEADOS);
console.log('semeadura ·', semeadura);

// ---- o teto existe: um GET sem paginação volta cortado em 1000 ----
const cortado = await page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v4'));
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/lancamentos?select=id&excluido_em=is.null',
    { headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
  return (await r.json()).length;
});
conferir('2. o servidor corta um pedido cru em ' + TETO + ' linhas', cortado === TETO, cortado);

// ---- a sincronização desce, e o Histórico do saldo conta o que desceu ----
//
// Este é o cenário do print dele, nos mesmos termos: o aparelho tem um
// lançamento, o servidor tem 1101, e a sincronização traz o de lá. Antes
// a linha do histórico dizia 1000 — o teto, não a conta.
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Sincronizar agora")'); await page.waitForTimeout(12000);
await semDialogo();
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Histórico do saldo")'); await page.waitForTimeout(1500);
const historico = limpo(await page.textContent('#folha'));
const naNuvem = historico.match(/nuvem[^·]*·\s*([\d.]+) lanç\./);
console.log('histórico:', (historico.match(/nuvem[^·]*·[^·]*·[^·]*/) || ['(nada)'])[0]);
conferir('3. a linha da nuvem traz os ' + (SEMEADOS + 1) + ' lançamentos, e não ' + TETO,
  !!naNuvem && Number(String(naNuvem[1]).replace(/\./g, '')) === SEMEADOS + 1,
  naNuvem ? naNuvem[1] + ' lanç.' : '(sem linha)');
await page.screenshot({ path: dir+'/y16-historico-completo.png', fullPage: true });
await page.keyboard.press('Escape'); await page.waitForTimeout(1200);

const total = await totalEmContas();
conferir('4. e o saldo é o saldo inteiro: −R$ 331,00', total === '-R$ 331,00', total);
await page.screenshot({ path: dir+'/y17-saldo-inteiro.png', fullPage: true });

// ---- aparelho novo entrando na conta: recebe tudo também ----
//
// O outro caminho de download, que não passa pela sincronização: trocar
// de celular, reinstalar o app, entrar do navegador de outra pessoa.
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(2500);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-contorno:has-text("Entrar na minha conta")'); await page.waitForTimeout(1200);
const campos = page.locator('.ent-campo input');
await campos.nth(0).fill(email);
await campos.nth(1).fill('senha123');
await page.click('.btn-dourado:has-text("Entrar")'); await page.waitForTimeout(20000);
await semDialogo();
const noAparelhoNovo = await totalEmContas();
conferir('5. aparelho novo recebe os ' + (SEMEADOS + 1) + ' e fecha em −R$ 331,00',
  noAparelhoNovo === '-R$ 331,00', noAparelhoNovo);
await page.screenshot({ path: dir+'/y18-aparelho-novo.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: o download passa do teto de mil linhas');

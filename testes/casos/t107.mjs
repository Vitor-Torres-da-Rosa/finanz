// Trazer os dados de outra conta tem de SUBSTITUIR, não somar.
//
// A folha diz "Isso substitui o que esta conta tem agora". Ela substituía
// no aparelho e, um segundo depois, a sincronização desfazia a promessa: o
// envio é upsert — não tira do servidor o que não veio junto — e o
// download devolvia o conjunto antigo. Os dois cofres viravam um só,
// somado. Conta com o mesmo extrato duas vezes, saldo dobrado.
//
// Foi o que aconteceu com o Vitor: o Inter saiu de uns R$ 32 mil negativos
// para R$ 66.084,66 negativos, o C6 nasceu com R$ 55 mil e o Itaú mudou de
// direção. Dois conjuntos somados.
//
// O restaurar backup sempre chamou apagarNaNuvemOqueNaoVeio(); o trazer
// nasceu sem esse passo na 5.9.8. Agora os dois usam a mesma marca.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
// Tudo o que o servidor recusar aparece aqui. Sem isso, uma sincronização
// que falha em silêncio faz o teste passar sem ter testado nada.
page.on('response', async (r) => {
  if (r.url().indexOf('/rest/v1/') < 0 && r.url().indexOf('/auth/v1/') < 0) return;
  if (r.status() < 300) return;
  let corpo = '';
  try { corpo = (await r.text()).slice(0, 200); } catch (e) { corpo = '(sem corpo)'; }
  console.log('REDE ' + r.status() + ' ' + r.request().method() + ' ' + r.url().replace(/^.*\/rest/, '/rest') + ' :: ' + corpo);
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

// A conta B abre vazia com o cofre da A ao lado, então o app oferece
// trazer sozinho (o convite da 5.9.8). Aqui eu digo "agora não": quem traz
// é o teste, na hora certa.
const semDialogo = async (quando) => {
  if (!(await page.locator('#dialogoFundo.aberta').count())) return;
  const t = limpo(await page.textContent('#dialogoTitulo').catch(() => ''));
  console.log('diálogo aberto ' + quando + ': "' + t + '" — fechando');
  const bs = page.locator('#dialogoAcoes button');
  await bs.nth((await bs.count()) - 1).click();
  await page.waitForTimeout(900);
};

// Depois de sair e entrar de novo, o app volta na aba onde estava — que
// era "Mais". Um clique só às vezes pega o fundo do diálogo que acabou de
// fechar, então insisto até o Início estar mesmo na tela.
const irParaInicio = async () => {
  for (let i = 0; i < 6; i++) {
    await semDialogo('a caminho do Início');
    if (await page.locator('#telaInicio:visible').count()) return;
    // O fundo do diálogo continua cobrindo a tela por um instante depois de
    // fechar, e o clique no rodapé some. force pula essa checagem.
    await page.locator('#navegacao button').nth(0).click({ force: true }).catch(function (e) {
      console.log('clique no Início não pegou:', String(e.message).split('\n')[0]);
    });
    await page.waitForTimeout(700);
  }
  // Sair trocava só a variável telaAtiva e deixava a classe `ativa` na tela
  // de onde se saiu. Entrando de novo, o app mostrava o Mais achando que
  // mostrava o Início, e o botão do Início virava um clique morto. Se
  // chegou aqui, é isso — e passar por outra aba destrava.
  console.log('o Início não respondeu; testando se passar por outra aba destrava');
  await page.locator('#navegacao button').nth(1).click({ force: true });
  await page.waitForTimeout(700);
  await page.locator('#navegacao button').nth(0).click({ force: true });
  await page.waitForTimeout(700);
  if (await page.locator('#telaInicio:visible').count()) {
    falhas++;
    console.log('FALHA · 0. o botão do Início fica morto depois de trocar de conta ' +
                '(telaAtiva dessincronizado da tela) — destravou passando por Transações');
    return;
  }

  const d = await page.evaluate(() => ({
    telas: [...document.querySelectorAll('.tela')].map((x) => x.id + (x.offsetParent !== null ? ':visivel' : ':oculta')),
    nav: [...document.querySelectorAll('#navegacao button')].map((b) => b.textContent.trim()),
    dialogo: (document.getElementById('dialogoFundo') || {}).className,
    folha: (document.getElementById('folhaFundo') || {}).className,
    entrada: (document.getElementById('entrada') || {}).className,
    corpo: document.body.className
  }));
  console.log('PRESO:', JSON.stringify(d));
  await page.screenshot({ path: dir + '/u00-preso.png', fullPage: true });
  throw new Error('não consegui chegar no Início');
};

// Uma conta bancária com um lançamento de saída, para o saldo ficar visível.
async function porDinheiroNaConta(nomeConta, reais) {
  await irParaInicio();
  await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(800);
  await folha().locator('input.entrada[type=text]').first().fill(nomeConta);
  await page.click('#folha .btn-ouro'); await page.waitForTimeout(1200);
  await page.click('#fab'); await page.waitForTimeout(900);
  await porDinheiro(folha().locator('.valor-grande'), reais);
  await folha().locator('input.entrada[type=text]').first().fill('Extrato ' + nomeConta);
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);
}

const totalEmContas = async () => {
  await irParaInicio();
  await page.waitForTimeout(900);
  const t = limpo(await page.textContent('#telaInicio'));
  const m = t.match(/Total em contas\s*(−?-?R\$ [\d.,]+)/);
  return m ? m[1].replace('−', '-') : '(não achei)';
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);

// ---- conta A: R$ 320,00 de saída, e nada disso sobe para a nuvem ----
//
// É o caso do Vitor: o cofre que ele trouxe vinha de outro projeto do
// Supabase, então os ids daquelas linhas não existiam no banco novo. Com
// os ids livres, o envio passa — e é aí que a união acontece.
//
// (Quando os ids JÁ existem sob outro usuário, o upsert bate na política
// de RLS, o envio inteiro morre com 400 e nada sincroniza. Esse é outro
// defeito, e tem teste próprio no fim.)
await page.route('**/rest/v1/**', (rota) => rota.abort());
await criarConta('t107a');
await porDinheiroNaConta('Banco Inter', '32000');
const saldoA = await totalEmContas();
conferir('1. a conta A fica com −R$ 320,00', saldoA === '-R$ 320,00', saldoA);
await page.waitForTimeout(3000);
await page.unroute('**/rest/v1/**');

// ---- sai e cria a conta B, que também tem dados próprios na nuvem ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Sair da conta")'); await page.waitForTimeout(800);
await page.click('#dialogoAcoes button:has-text("Sair da conta")'); await page.waitForTimeout(3000);

await criarConta('t107b');
await page.waitForTimeout(2500);
await semDialogo('logo depois de criar a conta B');
await porDinheiroNaConta('C6 Bank', '55000');
await semDialogo('depois de lançar na conta B');
const saldoB = await totalEmContas();
conferir('2. a conta B fica com −R$ 550,00', saldoB === '-R$ 550,00', saldoB);
await page.waitForTimeout(6000);

// A armadilha do teste: se os dados da conta B nunca chegarem na nuvem, o
// conflito que eu quero provar não existe, e o teste passa dos dois lados.
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(9000);
await semDialogo('depois de recarregar a conta B');
const bNaNuvem = await totalEmContas();
conferir('2b. os dados da conta B chegaram mesmo na nuvem',
  bNaNuvem === '-R$ 550,00', bNaNuvem + ' (se vier R$ 0,00, a nuvem está vazia e o teste não vale)');
await page.screenshot({ path: dir+'/u01-conta-b-antes.png', fullPage: true });

// ---- trazer os dados da conta A para dentro da B ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
await page.click('#telaMais .linha:has-text("Trazer dados de outra conta")'); await page.waitForTimeout(2500);
const convite = limpo(await page.textContent('#dialogoTexto').catch(() => ''));
console.log('o que a folha promete:', convite);
conferir('3. a folha promete substituir', /substitui/i.test(convite), convite.slice(0, 120));
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(9000);
await page.screenshot({ path: dir+'/u02-depois-de-trazer.png', fullPage: true });

// O que o SERVIDOR tem, não o que a tela mostra. É aqui que a união
// apareceria: linhas da conta B que ninguém apagou.
const noServidor = async (quando) => {
  const r = await page.evaluate(async () => {
    const chaves = { local: Object.keys(localStorage), sessao: Object.keys(sessionStorage) };
    let pac = localStorage.getItem('caixa.nuvem.v3');
    if (!pac) return { semSessao: true, chaves };
    let tok = null, pacote = null;
    try { pacote = JSON.parse(pac); } catch (e) { return { ilegivel: pac.slice(0, 160), chaves }; }
    tok = (pacote.nuvem || {}).access_token || pacote.access_token;
    if (!tok) return { semToken: Object.keys(pacote), chaves };
    const cfg = window.FINANZ_CONFIG;
    const h = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok };
    const pega = async (t) => (await (await fetch(cfg.supabaseUrl + '/rest/v1/' + t + '?select=*&excluido_em=is.null', { headers: h })).json());
    const contas = await pega('contas');
    const lanc = await pega('lancamentos');
    return { contas: contas.map((c) => c.nome), lancamentos: lanc.map((l) => l.descricao + '=' + (l.valor / 100).toFixed(2)) };
  });
  console.log('NUVEM ' + quando + ':', JSON.stringify(r));
  return r;
};
await noServidor('logo depois de trazer');

const depois = await totalEmContas();
conferir('4. depois de trazer, sobra SÓ o cofre A: −R$ 320,00',
  depois === '-R$ 320,00', depois + '  (somado daria -R$ 870,00)');

const contasNaTela = limpo(await page.textContent('#telaInicio'));
conferir('5. a conta "C6 Bank" da nuvem antiga não voltou',
  !/C6 Bank/.test(contasNaTela), contasNaTela.slice(contasNaTela.indexOf('Contas'), contasNaTela.indexOf('Contas') + 120));
conferir('6. e a conta que veio no cofre está lá', /Banco Inter/.test(contasNaTela));

// ---- e continua assim depois de uma sincronização nova ----
// Era aqui que o estrago aparecia: o envio não apagava nada, e o download
// trazia de volta tudo o que a conta já tinha na nuvem.
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(9000);
await noServidor('depois de recarregar');
const aindaDepois = await totalEmContas();
conferir('7. recarregando o app, a nuvem devolve o mesmo: −R$ 320,00',
  aindaDepois === '-R$ 320,00', aindaDepois);
const aindaContas = limpo(await page.textContent('#telaInicio'));
conferir('8. e o C6 Bank não ressuscita no download', !/C6 Bank/.test(aindaContas));
await page.screenshot({ path: dir+'/u03-depois-de-recarregar.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: trazer substitui, na nuvem também');

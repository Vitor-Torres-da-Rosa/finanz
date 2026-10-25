// Transferência órfã não pode travar a sincronização.
//
// Reclamação do Vitor em 25/10/2026: "new row for relation lancamentos
// violates check constraint transferencia_valida".
//
// A culpa é minha, da 5.17.1. Para impedir que uma referência morta
// travasse o envio, eu passei a anular a referência que aponta para o
// nada — que é o que o próprio banco faz quando apaga o alvo. Só que
// transferência tem uma regra a mais: o banco exige que ela tenha as duas
// contas, e diferentes entre si. Anulando uma perna eu produzia uma linha
// que o servidor recusa, e a recusa derruba o envio inteiro. Trocar um
// defeito pelo mesmo defeito por outra porta.
//
// Como se chega lá sem fazer nada de errado: outro aparelho apaga a
// conta, a transferência sobrevive porque ela mora na outra ponta, e o
// download traz um estado com a transferência e sem a conta.
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
const novaConta = async (nome) => {
  await irParaInicio();
  await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
  await folha().locator('input.entrada[type=text]').first().fill(nome);
  await page.click('#folha .btn-ouro'); await page.waitForTimeout(1500);
};
const avisoDeSincronia = async () => {
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const l = [...document.querySelectorAll('#telaMais .linha')]
      .find((x) => /Não está sincronizando|Sincronizar agora/.test(x.textContent || ''));
    return l ? (l.textContent || '').replace(/\s+/g, ' ').trim() : '(nenhuma)';
  });
};
const noServidor = async () => page.evaluate(async () => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v3'));
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/lancamentos?select=descricao&excluido_em=is.null', {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token } });
  const j = await r.json();
  return Array.isArray(j) ? j.map((l) => l.descricao).sort() : ('erro ' + r.status);
});

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t124-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await novaConta('Banco Inter');
await novaConta('C6 Bank');

// Uma transferência de uma conta para a outra.
await irParaInicio();
await page.click('#fab'); await page.waitForTimeout(1000);
await page.click('#folha button:has-text("Transferência")'); await page.waitForTimeout(900);
await porDinheiro(folha().locator('.valor-grande'), '50000');
await folha().locator('input.entrada[type=text]').first().fill('Passando para o C6');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(5000);
conferir('1. a transferência subiu', (await noServidor()).indexOf('Passando para o C6') >= 0,
  JSON.stringify(await noServidor()));

// Outro aparelho apaga a conta de destino. Marco como excluída pela API,
// que é o que a sincronização faz — a transferência continua viva, porque
// ela mora na outra ponta.
// Agora o estado que dá o problema: a transferência fica, a conta de
// destino some. Monto ele como uma CÓPIA na nuvem e mando o app voltar
// para ela — é um caminho de verdade do app, e é o único jeito de chegar
// nesse estado sem depender de qual conta o seletor escolheu.
//
// É assim que o Vitor chegou lá: a bagunça da duplicação apagou contas no
// servidor e deixou lançamentos apontando para elas.
const montado = await page.evaluate(async (marca) => {
  const pac = JSON.parse(localStorage.getItem('caixa.nuvem.v3'));
  const cfg = window.FINANZ_CONFIG;
  const cab = { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + pac.access_token };
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/contas?select=id,nome&excluido_em=is.null',
    { headers: cab });
  const contas = await r.json();
  const origem = contas[0];

  const estado = {
    perfil: { nome: 'Vitor' },
    contas: [{ id: origem.id, nome: origem.nome, tipo: 'Conta corrente',
               saldoInicial: 0, cor: '#E9B44C' }],
    // A transferência aponta para uma conta que NÃO está na lista acima.
    lancamentos: [{ id: marca + 'tr', tipo: 'transferencia', valor: 50000,
      descricao: 'Passando para o C6', categoria: 'Transferência', subcategoria: '',
      data: '2026-10-20', importacaoId: '', contaId: origem.id,
      contaDestinoId: 'conta-que-nao-existe-mais', criadoEm: Date.now() }],
    ativos: [], clientes: [], servicos: [], parcelas: [], pagamentos: [], metas: [],
    orcamentos: { geral: 0 }
  };
  const texto = JSON.stringify(estado);
  const fluxo = new Blob([texto]).stream().pipeThrough(new CompressionStream('gzip'));
  const bytes = new Uint8Array(await new Response(fluxo).arrayBuffer());
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);

  const hoje = new Date().toISOString().slice(0, 10);
  const post = await fetch(cfg.supabaseUrl + '/rest/v1/instantaneos', {
    method: 'POST',
    headers: Object.assign({ 'Content-Type': 'application/json', Prefer: 'return=minimal' }, cab),
    body: JSON.stringify([{ id: marca + 'cop', user_id: pac.usuario.id, dia: hoje,
      motivo: 'cópia feita por você', resumo: 'a de teste', dados: btoa(bin),
      tamanho: texto.length, criado_em: new Date().toISOString() }]) });
  return post.status;
}, 't124-' + Date.now() + '-');
console.log('cópia montada ·', montado);

await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
await page.click('#telaMais .linha:has-text("Voltar a uma data")'); await page.waitForTimeout(2500);
await page.click('#folha .linha:has-text("Cópia feita por você")'); await page.waitForTimeout(1200);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(14000);
// Fecha o que tiver aberto, caixa ou folha, até a tela ficar livre. A
// volta para uma cópia abre um aviso por cima da folha, e a ordem em que
// eles fecham varia.
for (let i = 0; i < 6; i++) {
  if (await page.locator('#dialogoFundo.aberta').count()) {
    const bs = page.locator('#dialogoAcoes button');
    await bs.nth((await bs.count()) - 1).click({ force: true }).catch(() => {});
    await page.waitForTimeout(800);
    continue;
  }
  if (await page.locator('#folha.aberta').count()) {
    await page.click('#cortina', { force: true }).catch(() => {});
    await page.waitForTimeout(800);
    continue;
  }
  break;
}

// E agora a pessoa mexe em alguma coisa, o que obriga um envio.
await irParaInicio();
await page.click('#fab'); await page.waitForTimeout(1000);
await porDinheiro(folha().locator('.valor-grande'), '18000');
await folha().locator('input.entrada[type=text]').first().fill('Luz');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(10000);

const aviso = await avisoDeSincronia();
console.log('aviso em Mais:', aviso.slice(0, 180));
conferir('2. a sincronização não travou', /Sincronizar agora/.test(aviso), aviso.slice(0, 120));
conferir('3. e não há erro de transferencia_valida',
  !/transferencia_valida|check constraint/.test(aviso), aviso.slice(0, 120));
conferir('4. o que veio depois subiu', (await noServidor()).indexOf('Luz') >= 0,
  JSON.stringify(await noServidor()));
conferir('5. o app avisa que um registro ficou de fora, em vez de calar',
  /não sobem para a nuvem/.test(aviso), aviso.slice(0, 180));
await page.screenshot({ path: dir+'/z19-transferencia-orfa.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: transferência órfã não trava o envio, e o app conta o que ficou de fora');

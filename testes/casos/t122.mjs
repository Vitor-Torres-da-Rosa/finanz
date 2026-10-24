// Referência solta não pode travar a sincronização inteira.
//
// Reclamação do Vitor em 24/10/2026, com o recado que a 5.16.1 passou a
// mostrar: "11 tentativa(s) sem sucesso · o servidor respondeu 409 · em
// POST /rest/v1/pagamentos. insert or update on table pagamentos violates
// foreign key constraint pagamentos_lancamento_id_fkey".
//
// O caminho: um pagamento registrado com "Lançar como entrada no caixa"
// cria um lançamento e guarda o id dele. Apagando esse lançamento em
// Transações, o pagamento ficava apontando para o nada — e o servidor
// recusa a referência morta com 409.
//
// E 409 não derruba aquele registro: derruba o envio inteiro. Nada mais
// sobe, por tentativa nenhuma, até alguém achar a referência.
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
    pagamentos: await pegar('pagamentos', 'select=valor,lancamento_id&excluido_em=is.null'),
    lancamentos: (await pegar('lancamentos', 'select=descricao&excluido_em=is.null')).map((l) => l.descricao)
  };
});
const avisoDeSincronia = async () => {
  await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
  return page.evaluate(() => {
    const l = [...document.querySelectorAll('#telaMais .linha')]
      .find((x) => /Não está sincronizando|Sincronizar agora/.test(x.textContent || ''));
    return l ? limpoLocal(l.textContent) : '(nenhuma)';
    function limpoLocal(t) { return (t || '').replace(/\s+/g, ' ').trim(); }
  });
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t122-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// Uma conta, um cliente, um serviço.
await irParaInicio();
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1300);

await page.click('#telaInicio .aba-topo button:has-text("Empreendedor")').catch(() => {});
await page.waitForTimeout(1000);
if (!(await page.locator('#telaInicio .cartao:has-text("Clientes")').count())) {
  const abas = page.locator('#telaInicio button', { hasText: 'Empreendedor' });
  if (await abas.count()) { await abas.first().click(); await page.waitForTimeout(1000); }
}
await page.click('#telaInicio .cartao:has-text("Clientes") .cartao-acao'); await page.waitForTimeout(1000);
await folha().locator('input.entrada[type=text]').first().fill('Diego Schena');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1500);

await page.click('#telaInicio .linha-alvo:has-text("Diego Schena")'); await page.waitForTimeout(1200);
await page.click('#folha button:has-text("+ Nova venda ou serviço")'); await page.waitForTimeout(1200);
await porDinheiro(folha().locator('.valor-grande'), '42500');
await folha().locator('input[placeholder="Ex.: Troca de embreagem"]').fill('Venda de celular');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
// Salvar o registro oferece montar o parcelamento. Aqui não quero plano
// nenhum: o pagamento vai ser único, à vista.
console.log('depois de salvar o registro:',
  limpo(await page.textContent('#dialogoTitulo').catch(() => '(sem caixa)')));
if (await page.locator('#dialogoFundo.aberta').count()) {
  const bs = page.locator('#dialogoAcoes button');
  await bs.nth((await bs.count()) - 1).click(); await page.waitForTimeout(1200);
}
await page.click('#folha .aba-cliente button:has-text("Pagos")'); await page.waitForTimeout(900);

// A partir daqui o servidor some. É o detalhe que faz o defeito: o
// lançamento nasce e morre sem nunca ter chegado lá. Apagar com a nuvem
// funcionando só MARCA a linha como excluída, e a linha marcada continua
// servindo de alvo para a chave estrangeira — inofensivo. Já o que nasceu
// no escuro não existe no banco, e aí o pagamento aponta para um id que o
// servidor nunca viu: 409, e a sincronização inteira para.
await ctx.route('**/rest/v1/**', (r) => r.abort());

// O pagamento que vira lançamento no caixa. É daqui que nasce a
// referência: o pagamento guarda o id do lançamento que ele criou.
await page.click('#folha button:has-text("+ Registrar pagamento")'); await page.waitForTimeout(1200);
await porDinheiro(folha().locator('.valor-grande'), '42500');
const marcar = page.locator('#folha button:has-text("Lançar como entrada no caixa")');
if ((await marcar.getAttribute('aria-pressed')) !== 'true') await marcar.click();
await page.waitForTimeout(400);
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2000);
await page.click('#cortina', { force: true }).catch(() => {}); await page.waitForTimeout(800);

const curto = (c) => c.pagamentos.length + ' pagamento(s), lancamento_id=' +
  (c.pagamentos[0] ? JSON.stringify(c.pagamentos[0].lancamento_id) : '-') +
  ', lançamentos: ' + JSON.stringify(c.lancamentos);
// ---- e a pessoa apaga aquele lançamento, ainda sem rede ----
await irParaInicio();
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1500);
await page.click('#telaTransacoes .linha:has-text("Diego Schena")'); await page.waitForTimeout(1200);
await page.click('#folha button:has-text("Excluir lançamento")'); await page.waitForTimeout(1000);
await page.click('#dialogoAcoes button:has-text("Excluir lançamento")'); await page.waitForTimeout(2500);
// Sem servidor, o app não consegue guardar a cópia de antes de apagar e
// pergunta se é para apagar assim mesmo. É o caminho de quem está sem
// rede — e é o que eu quero aqui.
if (await page.locator('#dialogoAcoes button:has-text("Apagar assim mesmo")').count()) {
  await page.click('#dialogoAcoes button:has-text("Apagar assim mesmo")');
  await page.waitForTimeout(1500);
}
await page.click('#cortina', { force: true }).catch(() => {}); await page.waitForTimeout(800);

// A rede volta. Tudo o que foi feito no escuro tenta subir agora.
await ctx.unroute('**/rest/v1/**');
await page.evaluate(() => window.dispatchEvent(new Event('online')));
await page.waitForTimeout(16000);

// A prova: a sincronização seguiu. Sem a guarda ela para aqui com 409 e
// NADA mais sobe — nem o que não tem relação nenhuma com o pagamento.
const aviso = await avisoDeSincronia();
console.log('aviso em Mais:', aviso);
conferir('1. a sincronização continua funcionando', /Sincronizar agora/.test(aviso), aviso);
conferir('2. e não há 409 de chave estrangeira', !/409|foreign key/.test(aviso), aviso);
await page.screenshot({ path: dir+'/z17-sem-409.png', fullPage: true });

const depois = await naConta();

conferir('3. o lançamento apagado não está no servidor', depois.lancamentos.length === 0,
  JSON.stringify(depois.lancamentos));
conferir('4. o pagamento continua lá, sem o apontamento morto',
  depois.pagamentos.length === 1 && !depois.pagamentos[0].lancamento_id, curto(depois));

// E o que vier depois sobe normalmente: é isso que o 409 impedia.
await irParaInicio();
// Volto para a Visão geral: no Empreendedor o botão + abre cliente novo,
// não lançamento.
await page.click('#telaInicio button:has-text("Visão geral")').catch(() => {});
await page.waitForTimeout(1000);
await page.click('#fab'); await page.waitForTimeout(1200);
if (await folha().locator('.valor-grande').count()) {
  await porDinheiro(folha().locator('.valor-grande'), '18000');
  await folha().locator('input.entrada[type=text]').first().fill('Luz');
  await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(8000);
}
const comNovo = await naConta();
// ATENÇÃO: esta passa COM e SEM a guarda, e por um motivo que vale
// anotar: o envio manda lancamentos ANTES de pagamentos, então o "Luz"
// entra e só depois o 409 derruba o resto. Quem some com a sincronização
// travada é o que vem depois dos pagamentos — parcelas, metas — e a volta
// do servidor, que nunca acontece. Quem pega o defeito são as
// verificações 1, 2 e 4.
conferir('5. e o que vem depois sobe normalmente',
  comNovo.lancamentos.indexOf('Luz') >= 0, JSON.stringify(comNovo.lancamentos));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: referência solta não trava mais a sincronização');

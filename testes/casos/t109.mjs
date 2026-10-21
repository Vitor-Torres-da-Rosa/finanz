// O extrato do banco fica guardado como veio.
//
// Até aqui o app lia o arquivo, criava os lançamentos e esquecia o
// original. Se a leitura saísse errada meses depois, alguém tinha de
// caçar o PDF no celular — e o celular do Vitor já perdeu os dados uma
// vez. Pedido dele em 21/10/2026: "tbm deve ficar na nuvem os arquivos
// originais de extrato dos bancos que foi trazido".
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('response', async (r) => {
  if (r.url().indexOf('/rest/v1/') < 0 || r.status() < 300) return;
  let b = ''; try { b = (await r.text()).slice(0, 160); } catch (e) { b = ''; }
  console.log('REDE ' + r.status() + ' ' + r.request().method() + ' ' + r.url().replace(/^.*\/rest/, '/rest') + ' :: ' + b);
});

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();
let arquivo = amostras + '/inter.pdf';
page.on('filechooser', async fc => { await fc.setFiles(arquivo); });

// O que está guardado no servidor, sem baixar o conteúdo.
const arquivosNaNuvem = async () => page.evaluate(async () => {
  const pac = localStorage.getItem('caixa.nuvem.v3');
  if (!pac) return 'sem sessão';
  const tok = JSON.parse(pac).access_token;
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/arquivos_extrato?select=id,nome,tipo,tamanho,importacao_id,conteudo', {
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok } });
  return (await r.json()).map((a) => ({
    nome: a.nome, tipo: a.tipo, tamanho: a.tamanho,
    temConteudo: !!(a.conteudo && a.conteudo.length), leva: !!a.importacao_id
  }));
});

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t109-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// ---- a conta primeiro, pela tela ----
//
// Deixar a importação criar a conta é outro caminho, e ele tem um defeito
// próprio: a conta não aparece no Início depois. Isso já acontecia antes
// desta mudança (conferido contra o commit anterior) e tem de ser caçado
// à parte — aqui atrapalharia o que este teste existe para provar.
await page.click('#telaInicio .cartao:has-text("Contas") .cartao-acao'); await page.waitForTimeout(900);
await page.locator('#folha input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1500);

// ---- importa um extrato de verdade ----
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(800);
await page.click('#telaMais label.linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .cabeca-banco', { timeout: 60000 }); await page.waitForTimeout(800);
const quantos = await page.locator('#folha .item-extrato').count();
conferir('1. o app leu a fatura', quantos > 0, quantos + ' lançamento(s)');
// A conta já existe, então a folha deve ter escolhido ela sozinha.
await page.waitForTimeout(800);
// O aviso de "Conta criada" cobre o rodapé por um instante; sem o force o
// clique some nele e o teste morre esperando um botão que está ali.
// Criar a conta remonta a folha inteira, então espero o botão renascer
// antes de clicar — clicar num elemento já descartado não dispara nada.
await page.waitForSelector('#folha .btn-ouro:has-text("Importar")', { timeout: 60000 });
await page.waitForTimeout(600);
await page.locator('#folha .btn-ouro:has-text("Importar")').first().click();
await page.waitForSelector('#dialogoFundo.aberta', { timeout: 60000 });
console.log('pergunta:', limpo(await page.textContent('#dialogoTitulo')),
            '|', JSON.stringify(await page.$$eval('#dialogoAcoes button', ns => ns.map(b => b.textContent.trim()))));
await page.locator('#dialogoAcoes button').nth(0).click();
await page.waitForTimeout(5000);


// ---- o original subiu junto ----
let guardados = await arquivosNaNuvem();
console.log('na nuvem:', JSON.stringify(guardados));
conferir('2. o arquivo original ficou guardado na nuvem',
  Array.isArray(guardados) && guardados.length === 1, JSON.stringify(guardados));
conferir('3. com o nome e o tipo certos',
  Array.isArray(guardados) && /inter\.pdf$/.test((guardados[0] || {}).nome) &&
  (guardados[0] || {}).tipo === 'application/pdf',
  Array.isArray(guardados) ? (guardados[0] || {}).nome + ' · ' + (guardados[0] || {}).tipo : '-');
conferir('4. com o conteúdo dentro, e ligado à leva que ele gerou',
  Array.isArray(guardados) && (guardados[0] || {}).temConteudo && (guardados[0] || {}).leva && (guardados[0] || {}).tamanho > 1000,
  Array.isArray(guardados) ? (guardados[0] || {}).tamanho + ' bytes' : '-');

// ---- e aparece para baixar na folha de Conferir ----
// Recarregar em vez de caçar o caminho de volta pelo rodapé: o app sempre
// abre no Início, e de quebra prova que o que foi lançado atravessou a
// nuvem. Ler o texto de uma tela escondida devolveria o desenho antigo.
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(9000);
conferir('5. a conta com os lançamentos está no Início',
  !!(await page.locator('#telaInicio:visible').count()) &&
  /Banco Inter/.test(limpo(await page.textContent('#telaInicio'))),
  limpo(await page.textContent('#telaInicio')).replace(/^[\s\S]*Contas/, 'Contas').slice(0, 120));

// Tocar na linha da conta (não no lápis) abre a folha dela, de onde se
// chega a "Conferir esta conta".
await page.click('#telaInicio .cartao:has-text("Contas") .linha:has-text("Inter")');
await page.waitForTimeout(1400);
await page.click('#folha .btn-ouro:has-text("Conferir esta conta")');
await page.waitForTimeout(3000);
const naConferencia = limpo(await page.textContent('#folha'));
conferir('6. a folha de Conferir lista o extrato importado',
  /Extratos importados/.test(naConferencia), naConferencia.slice(0, 120));
const baixar = await page.locator('#folha button:has-text("Baixar"):visible').count();
conferir('7. e oferece baixar o original', baixar === 1, baixar + ' botão(ões) visível(is)');
await page.screenshot({ path: dir+'/x01-conferir-com-arquivo.png', fullPage: true });

// ---- tirando a leva, o arquivo some junto ----
await page.click('#folha button:has-text("Tirar")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(4000);
guardados = await arquivosNaNuvem();
conferir('8. desfazendo a importação, o arquivo sai da nuvem também',
  Array.isArray(guardados) && guardados.length === 0, JSON.stringify(guardados));

// ---- deixando a IMPORTAÇÃO criar a conta ----
//
// Era o sintoma reportado: o app cria a conta do banco, lança o extrato,
// e a conta não aparecia no Início. A causa não era da importação — a
// sincronização que já estava indo voltava sem ela e engolia a conta
// recém-nascida.
//
// ATENÇÃO: esta verificação NÃO pega aquele defeito. Ela depende de uma
// sincronização estar em voo no instante exato em que a conta nasce, e
// neste fluxo isso não acontece — conferido: ela passa igual com o
// conserto e sem ele. Fica aqui como fumaça do caminho inteiro (importar
// criando a conta funciona), não como cobertura. Quem segura a volta de
// propósito e prova o conserto é o t112.
arquivo = amostras + '/nubank.pdf';
// A folha de Conferir ainda está aberta e cobre o rodapé. Recarregar é
// mais curto do que caçar o jeito de fechar, e o app abre no Início.
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(8000);
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
await page.click('#telaMais label.linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .cabeca-banco', { timeout: 60000 }); await page.waitForTimeout(900);
// Com a conta do Inter já existindo, a folha escolhe ela sozinha. Abro o
// seletor e peço a conta nova, que é o caminho que eu quero testar.
await page.click('#folha .selecao >> nth=0'); await page.waitForTimeout(1000);
const opcoes = await page.$$eval('#escolhaLista .escolha-item',
  ns => ns.map(n => n.textContent.replace(/\s+/g, ' ').trim()));
console.log('contas oferecidas:', JSON.stringify(opcoes));
await page.click('#escolhaLista .escolha-item:has-text("Criar conta")'); await page.waitForTimeout(2500);
await page.waitForSelector('#folha .btn-ouro:has-text("Importar")', { timeout: 60000 });
await page.waitForTimeout(600);
await page.locator('#folha .btn-ouro:has-text("Importar")').first().click();
await page.waitForSelector('#dialogoFundo.aberta', { timeout: 60000 });
await page.locator('#dialogoAcoes button').nth(0).click();
await page.waitForTimeout(6000);

await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(9000);
const comNubank = limpo(await page.textContent('#telaInicio'));
conferir('9. a conta criada pela própria importação continua lá',
  /Nubank|Nu Pagamentos|NU /i.test(comNubank),
  comNubank.replace(/^[\s\S]*Contas/, 'Contas').slice(0, 150));
await page.screenshot({ path: dir+'/x02-conta-da-importacao.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: o extrato original fica guardado e dá para baixar');

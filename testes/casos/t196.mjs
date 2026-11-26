// Conferido ✓ (pedido do Vitor em 25/11/2026): com a conta batendo, a pessoa
// confirma e os PDFs da conta viram uma versão compacta (o que o app leu),
// cifrada com a senha dos dados (desde a 5.111.0, sem ela nada vai para o
// servidor, então o arquivo só existe lá com a senha). Reler e Relançar
// continuam funcionando, sem pedir senha de novo.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const folha = () => page.locator('#folha');

await page.clock.setFixedTime(new Date(2026, 10, 17, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('finanz.cofre.auto', 'senha-do-cofre-123'); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t196-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.click('#telaInicio .cartao-acao:has-text("+ Nova")'); await page.waitForTimeout(500);
await folha().locator('input.entrada[type=text]').first().fill('Banco Inter');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(900);
page.on('filechooser', async fc => { await fc.setFiles(amostras + '/inter-sinais.pdf'); });
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(700);
await page.click('#telaMais .linha:has-text("Importar extrato")');
await page.waitForSelector('#folha .item-extrato', { timeout: 60000 }); await page.waitForTimeout(600);
// ---- importa ----
await page.waitForSelector('#folha .btn-ouro:has-text("Importar")', { timeout: 60000 }); await page.waitForTimeout(600);
await page.locator('#folha .btn-ouro:has-text("Importar")').first().click();
await page.waitForSelector('#dialogoFundo.aberta', { timeout: 60000 });
await page.locator('#dialogoAcoes button').nth(0).click();
await page.waitForTimeout(5000);

const nuvem = (metodo, caminho, corpo) => page.evaluate(async ({ metodo, caminho, corpo }) => {
  const tok = JSON.parse(localStorage.getItem('caixa.nuvem.v4')).access_token;
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + caminho, { method: metodo, body: corpo ? JSON.stringify(corpo) : undefined,
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Prefer: 'return=minimal' } });
  return r.status === 204 || r.status === 201 ? [] : r.json().catch(() => []);
}, { metodo, caminho, corpo });
const original = (await nuvem('GET', '/rest/v1/arquivos_extrato?select=id,tipo,tamanho'))[0];
conferir('0. o PDF subiu como veio do banco', original && original.tipo === 'application/pdf' && original.tamanho > 0, JSON.stringify(original));

const fecharTudo = async () => {
  for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
};
const abrirConta = async () => {
  await fecharTudo();
  await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(800);
  await page.click('#telaInicio .cartao:has-text("Contas") .linha:has-text("Inter")'); await page.waitForTimeout(1200);
};
const abrirPainel = async () => {
  await abrirConta();
  await page.evaluate(() => { const b = document.querySelector('#folha .botao-saldo-correto'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); });
  await page.waitForTimeout(500);
  await page.waitForFunction(() => !/Vendo os arquivos/.test((document.querySelector('#folha .estado-conferido') || {}).textContent || 'Vendo os arquivos'), null, { timeout: 15000 }).catch(() => {});
};
const abrirConferencia = async () => {
  await abrirPainel();
  await page.click('#folha .btn-ouro:has-text("Conferir esta conta")'); await page.waitForTimeout(1200);
  await page.waitForFunction(() => !/Vendo os arquivos/.test((document.querySelector('#folha .estado-conferido') || {}).textContent || 'Vendo os arquivos'), null, { timeout: 15000 }).catch(() => {});
};

// ---- embaixo do saldo: só a pergunta; abrindo, as 3 opções e o conferido ----
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(8000);
await abrirConta();
const fechado = await page.evaluate(() => {
  const vis = (el) => !!el && el.offsetParent !== null;
  const f = document.querySelector('#folha');
  const achar = (t) => [...f.querySelectorAll('button')].find(b => b.textContent.trim() === t);
  return { pergunta: vis(f.querySelector('.botao-saldo-correto')), conferir: vis(achar('Conferir esta conta')), ajustar: vis(achar('Ajustar saldo')),
    editar: vis(achar('Editar esta conta')), cartao: vis(f.querySelector('.cartao-conferido')) };
});
conferir('1. embaixo do saldo aparece só "O saldo está correto?"', fechado.pergunta && !fechado.conferir && !fechado.ajustar && !fechado.editar && !fechado.cartao, JSON.stringify(fechado));
await page.screenshot({ path: dir + '/z196-pergunta-fechada.png' });
await abrirPainel();
const aberto = await page.evaluate(() => {
  const vis = (el) => !!el && el.offsetParent !== null;
  const f = document.querySelector('#folha');
  const achar = (t) => [...f.querySelectorAll('button')].find(b => b.textContent.trim() === t);
  return { conferir: vis(achar('Conferir esta conta')), ajustar: vis(achar('Ajustar saldo')), editar: vis(achar('Editar esta conta')), cartao: vis(f.querySelector('.cartao-conferido')) };
});
const card = limpo(await folha().locator('.cartao-conferido').textContent());
conferir('2. tocando, abrem as 3 opções e o "Está tudo certo?" com o botão ligado',
  aberto.conferir && aberto.ajustar && aberto.editar && aberto.cartao &&
  /Está tudo certo\?/.test(card) && /1 arquivo\(s\) ainda como vieram do banco/.test(card) &&
  await folha().locator('.botao-conferido:not([disabled])').count() === 1 && await folha().locator('.cartao-conferido [data-dica="conta.conferido.v3"]').count() === 1, JSON.stringify(aberto) + ' ' + card.slice(0, 120));
await page.screenshot({ path: dir + '/z196-pergunta-aberta.png' });
await folha().locator('.cartao-conferido').screenshot({ path: dir + '/z196-conferido-antes.png' }).catch(() => {});

// ---- conferindo: usa a senha dos dados, já aberta ----
// Sob carga a lista de arquivos demora: espera o botão ligar antes de tocar.
await page.waitForSelector('#folha .botao-conferido:not([disabled])', { timeout: 60000 });
await folha().locator('.botao-conferido').click();
await page.waitForSelector('#dialogoFundo.aberta'); await page.waitForTimeout(400);
const perg = limpo(await page.textContent('#dialogoFundo'));
conferir('3. pergunta antes, explicando o que muda', /Marcar como conferido\?/.test(perg) && /Baixar o PDF original deixa de dar/.test(perg), perg.slice(0, 160));
await page.click('#dialogoAcoes button:has-text("Conferido")');
await page.waitForTimeout(800);
conferir('4. com a senha dos dados, não pede outra senha', await folha().locator('.campo-senha-extratos').count() === 0);
await page.waitForFunction(() => /Conferido ✓|Nada foi trocado/.test((document.querySelector('#dialogoFundo.aberta') || {}).textContent || ''), null, { timeout: 60000 });
const fim = limpo(await page.textContent('#dialogoFundo'));
conferir('5. conferido: diz de quanto para quanto o arquivo foi', /1 extrato\(s\) conferido\(s\) ✓/.test(fim) && /foram de \d+ KB para [\d,]+ (KB|bytes)/.test(fim), fim);
await page.screenshot({ path: dir + '/z196-conferido-fim.png' });

const guardado = (await nuvem('GET', '/rest/v1/arquivos_extrato?select=id,tipo,tamanho,conteudo'))[0];
let pac = {}; try { pac = JSON.parse(guardado.conteudo); } catch (e) { /* */ }
console.log('tamanho original', original.tamanho, '| conferido', guardado.tamanho);
conferir('6. no servidor: o mesmo arquivo, agora conferido, menor, cifrado e sem o texto à vista',
  guardado.id === original.id && guardado.tipo === 'application/vnd.finanz.conferido' && guardado.tamanho < original.tamanho &&
  pac.formato === 'extrato-conferido' && pac.cifra && pac.cifra.nome === 'AES-GCM' && pac.kdf && pac.kdf.nome === 'cofre' &&
  !/Boleto|Tarifa|%PDF/.test(guardado.conteudo), guardado.tipo + ' ' + guardado.tamanho);

await page.click('#dialogoAcoes button'); await page.waitForTimeout(1500);
await page.waitForFunction(() => !/Vendo os arquivos/.test((document.querySelector('#folha .estado-conferido') || {}).textContent || 'Vendo os arquivos'), null, { timeout: 15000 }).catch(() => {});
const card2 = limpo(await folha().locator('.cartao-conferido').textContent().catch(() => ''));
conferir('7. a conta volta com a pergunta aberta, dizendo que está conferido, sem o botão',
  /Conferido ✓ O extrato desta conta está guardado na versão compacta e cifrada/.test(card2) && !(await folha().locator('.botao-conferido:visible').count()) &&
  await folha().locator('.botao-saldo-correto[aria-expanded="true"]').count() === 1, card2);
await abrirConferencia();
conferir('7b. a conferência não mostra mais o cartão do conferido', await folha().locator('.cartao-conferido').count() === 0);
await page.waitForFunction(() => /Conferido ✓/.test((document.querySelector('#folha [data-leva] button') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
conferir('8. na lista de extratos importados, o "Baixar" virou "Conferido ✓"',
  await folha().locator('[data-leva] button[disabled]:has-text("Conferido ✓")').count() === 1);
await folha().locator('.cartao-conferido').screenshot({ path: dir + '/z196-conferido-depois.png' }).catch(() => {});

// ---- a conta marca o conferido ----
await abrirConta();
await page.waitForFunction(() => /no total|Nenhum arquivo/.test((document.querySelector('#folha .tamanho-extratos') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
const ext = limpo(await page.textContent('#folha .cartao-extratos'));
conferir('9. nos extratos da conta, o arquivo aparece como conferido', /1 conferido\(s\) ✓/.test(ext) && /conferido ✓ · inter-sinais\.pdf/.test(ext), ext.slice(0, 220));

// ---- abre o app de novo: a chave não fica guardada ----
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(6000);
// o boleto entra errado à mão, para o reler ter o que corrigir
await abrirConta();
await page.click('#folha .cartao-extratos .linha:has-text("03/11/2026")'); await page.waitForTimeout(1500);
await page.waitForSelector('#folha .botao-reler:not([disabled])', { timeout: 20000 });
const dentro = limpo(await page.textContent('#folha'));
conferir('10. dentro do extrato: conferido, sem o PDF para baixar, e o reler ligado',
  /Tamanho do arquivo\s*[\d,]+ (KB|bytes) · conferido ✓/.test(dentro) && /PDF trocado pela versão compacta/.test(dentro) &&
  await folha().locator('button[disabled]:has-text("PDF trocado")').count() === 1, (dentro.match(/Tamanho do arquivo.{0,40}/) || [''])[0]);
await page.screenshot({ path: dir + '/z196-extrato-conferido.png' });
await page.click('#folha .linha:has-text("Boleto recebido")'); await page.waitForTimeout(900);
await page.click('#folha .segmentos button:has-text("Saída")'); await page.waitForTimeout(700);
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2500);
await abrirConta();
await page.click('#folha .cartao-extratos .linha:has-text("03/11/2026")'); await page.waitForTimeout(1500);
await page.waitForSelector('#folha .botao-reler:not([disabled])', { timeout: 20000 });
await page.click('#folha .botao-reler');
await page.waitForTimeout(800);
conferir('11. reler o conferido não pede senha: abre com a senha dos dados', await folha().locator('.campo-senha-extratos').count() === 0);
await page.waitForSelector('#dialogoFundo.aberta', { timeout: 60000 }); await page.waitForTimeout(500);
const pergunta = limpo(await page.textContent('#dialogoFundo'));
conferir('13. relendo a versão compacta, acha o boleto com o sinal trocado', /Corrigir 1 lançamento\(s\)\?/.test(pergunta) &&
  /Boleto recebido.*R\$ 500,00: despesa → receita/.test(pergunta), pergunta);
await page.click('#dialogoAcoes button:has-text("Corrigir")'); await page.waitForTimeout(2500);
const depois = limpo(await page.textContent('#folha'));
conferir('14. corrigido a partir do conferido', /Entradas\s*\+ R\$ 1\.388,88/.test(depois), (depois.match(/Entradas.{0,60}/) || [''])[0]);

// ---- relançar o conferido: a chave já está na memória ----
await abrirConferencia();
await page.waitForSelector('#folha [data-leva] button:has-text("Relançar"):not([disabled])', { timeout: 15000 });
await folha().locator('[data-leva] button:has-text("Relançar")').click();
await page.waitForSelector('#folha .item-extrato', { timeout: 60000 }); await page.waitForTimeout(600);
const linhas = await folha().locator('.item-extrato').count();
conferir('15. relançando o conferido, as 7 linhas voltam sem pedir a senha de novo', linhas === 7, linhas);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

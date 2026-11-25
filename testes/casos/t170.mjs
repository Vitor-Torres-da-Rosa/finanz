// Extrato do Inter com sinais (pedido do Vitor em 17/11/2026): sem menos é
// receita, com menos é despesa, não importa a palavra ("Boleto recebido",
// "Ressarcimento - pagamento cartão", "Pix enviado devolvido"). O saldo da
// linha acerta o sinal que faltou. E "Reler e corrigir" conserta, só quando
// a pessoa toca, o que já entrou errado.
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
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t170-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
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
const itens = await page.$$eval('#folha .item-extrato', ns => ns.map(n => n.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()));
console.log(itens.join('\n'));
const sinal = (re) => { const t = itens.find(x => re.test(x)) || ''; const m = t.match(/([+−-]) ?R\$ ([\d.]+,\d\d)\s*$/); return m ? (m[1] === '+' ? '+' : '-') + m[2] : '?'; };
const achados = {
  boleto: sinal(/Boleto recebido/), ressarc: sinal(/Ressarcimento/), devolvido: sinal(/devolvido/),
  pagamento: sinal(/Pagamento fatura/), pix: sinal(/Pix enviado(?!.*devolvido)/), recebido: sinal(/Maria Souza/), tarifa: sinal(/Tarifa/)
};
console.log(JSON.stringify(achados));
conferir('1. sem o menos é receita: boleto recebido, ressarcimento e Pix devolvido', achados.boleto === '+500,00' && achados.ressarc === '+472,50' &&
  achados.devolvido === '+166,38' && achados.recebido === '+250,00', JSON.stringify(achados));
conferir('2. com o menos é despesa', achados.pagamento === '-472,50' && achados.pix === '-166,38', JSON.stringify(achados));
const resumo = limpo(await folha().locator('.resumo-extrato').textContent().catch(() => ''));
conferir('3. a tarifa sem o menos sai como despesa porque o saldo da linha prova, e tudo bate',
  achados.tarifa === '-30,00' && /tudo bate ✓/.test(resumo) && /1 lançamento\(s\) tiveram o sinal acertado pelo saldo/.test(resumo) &&
  (await folha().locator('.item-extrato:has-text("Tarifa") .acertado-pelo-saldo').count()) === 1, resumo);
await page.screenshot({ path: dir + '/z84-inter-sinais.png' });

// ---- importa ----
await page.waitForSelector('#folha .btn-ouro:has-text("Importar")', { timeout: 60000 }); await page.waitForTimeout(600);
await page.locator('#folha .btn-ouro:has-text("Importar")').first().click();
await page.waitForSelector('#dialogoFundo.aberta', { timeout: 60000 });
await page.locator('#dialogoAcoes button').nth(0).click();
await page.waitForTimeout(5000);

// ---- simula o extrato que entrou errado: o boleto vira despesa à mão ----
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(8000);
const abrirLeva = async () => {
  for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
  await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(800);
  await page.click('#telaInicio .cartao:has-text("Contas") .linha:has-text("Inter")'); await page.waitForTimeout(1200);
  await page.click('#folha .cartao-extratos .linha:has-text("03/11/2026")'); await page.waitForTimeout(1500);
};
// 19/11/2026: quanto os arquivos ocupam na conta.
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(800);
await page.click('#telaInicio .cartao:has-text("Contas") .linha:has-text("Inter")'); await page.waitForTimeout(1200);
await page.waitForFunction(() => /no total|Nenhum arquivo/.test((document.querySelector('#folha .tamanho-extratos') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
const ext = limpo(await page.textContent('#folha .cartao-extratos'));
conferir('3b. a conta diz quanto os arquivos ocupam, no total e em cada extrato', /1 arquivo\(s\) guardado\(s\) na sua conta · \d+ KB no total/.test(ext) &&
  /\d+ KB · inter-sinais\.pdf · 7 lançamento\(s\)/.test(ext), ext.slice(0, 200));
await page.locator('#folha .cartao-extratos').screenshot({ path: dir + '/z105-tamanho-extratos.png' }).catch(() => {});

// 25/11/2026: arquivo que sobrou de importação já tirada não entra na conta
// dos guardados nem aparece; a limpeza do dia apaga sozinha o que subiu há
// mais de um dia. O recém-subido (pode ser de outro celular) fica.
const nuvem = (metodo, caminho, corpo) => page.evaluate(async ({ metodo, caminho, corpo }) => {
  const tok = JSON.parse(localStorage.getItem('caixa.nuvem.v4')).access_token;
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + caminho, { method: metodo, body: corpo ? JSON.stringify(corpo) : undefined,
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json', Prefer: 'return=minimal' } });
  return r.status === 204 || r.status === 201 ? [] : r.json().catch(() => []);
}, { metodo, caminho, corpo });
const jaTem = await nuvem('GET', '/rest/v1/arquivos_extrato?select=id,conta_id,user_id');
const dono = jaTem[0];
const solto = (id, quando) => nuvem('POST', '/rest/v1/arquivos_extrato', [{ id, user_id: dono.user_id, importacao_id: 'leva-que-sumiu-' + id,
  conta_id: dono.conta_id, nome: id + '.pdf', tipo: 'application/pdf', tamanho: 50000, conteudo: 'JVBERi0=', criado_em: quando.toISOString() }]);
await solto('solto-velho', new Date(2026, 10, 10, 12, 0, 0));
await solto('solto-novo', new Date(2026, 10, 18, 8, 0, 0));
for (let i = 0; i < 5 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(600); }
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(800);
await page.click('#telaInicio .cartao:has-text("Contas") .linha:has-text("Inter")'); await page.waitForTimeout(1200);
await page.waitForFunction(() => /no total|Nenhum arquivo/.test((document.querySelector('#folha .tamanho-extratos') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
const ext2 = limpo(await page.textContent('#folha .cartao-extratos'));
conferir('3d. a contagem só leva os arquivos dos extratos da lista, e o que sobrou não aparece nem pede para apagar',
  /1 arquivo\(s\) guardado\(s\) na sua conta/.test(ext2) && !/Apagar|já foram tiradas/.test(ext2) &&
  !(await page.locator('#folha .arquivos-soltos').count()), ext2.slice(0, 220));
// No dia seguinte, a limpeza do dia roda sozinha.
await page.clock.setFixedTime(new Date(2026, 10, 18, 9, 0, 0));
await page.reload({ waitUntil: 'networkidle' });
let depoisSoltos = [];
for (let i = 0; i < 30; i++) {
  await page.waitForTimeout(1000);
  depoisSoltos = (await nuvem('GET', '/rest/v1/arquivos_extrato?select=id')).map(x => x.id);
  if (!depoisSoltos.includes('solto-velho')) break;
}
conferir('3e. sem perguntar, some só o que sobrou há mais de um dia; o novo e o do extrato ficam',
  !depoisSoltos.includes('solto-velho') && depoisSoltos.includes('solto-novo') && depoisSoltos.includes(dono.id), depoisSoltos.join(','));
await nuvem('DELETE', '/rest/v1/arquivos_extrato?id=eq.solto-novo');
await abrirLeva();
await page.waitForSelector('#folha .botao-reler:not([disabled])', { timeout: 20000 });
const dentro = limpo(await page.textContent('#folha'));
conferir('3c. dentro do extrato, o tamanho do arquivo numa linha e no botão de baixar', /Tamanho do arquivo\s*\d+ KB/.test(dentro) && /Baixar o arquivo \(\d+ KB\)/.test(dentro), (dentro.match(/Tamanho do arquivo.{0,12}/) || [''])[0]);
await page.screenshot({ path: dir + '/z108-tamanho-no-extrato.png' });
await page.click('#folha .linha:has-text("Boleto recebido")'); await page.waitForTimeout(900);
await page.click('#folha .segmentos button:has-text("Saída")'); await page.waitForTimeout(700);
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2500);
await abrirLeva();
const antes = limpo(await page.textContent('#folha'));
conferir('4. o boleto está como despesa (o erro de antes)', /Saídas\s*− R\$ 1\.168,88/.test(antes), (antes.match(/Entradas.{0,60}/) || [''])[0]);

// ---- Reler e corrigir ----
await page.waitForSelector('#folha .botao-reler:not([disabled])', { timeout: 20000 });
await page.screenshot({ path: dir + '/z85-reler-botao.png' });
await page.click('#folha .botao-reler');
await page.waitForSelector('#dialogoFundo.aberta', { timeout: 60000 }); await page.waitForTimeout(500);
const pergunta = limpo(await page.textContent('#dialogoFundo'));
conferir('5. relendo, mostra só o boleto e pede confirmação antes de mexer', /Corrigir 1 lançamento\(s\)\?/.test(pergunta) &&
  /Boleto recebido.*R\$ 500,00: despesa → receita/.test(pergunta) && !/Tarifa/.test(pergunta), pergunta);
await page.screenshot({ path: dir + '/z86-reler-pergunta.png' });
await page.click('#dialogoAcoes button:has-text("Corrigir")'); await page.waitForTimeout(2500);
const depois = limpo(await page.textContent('#folha'));
conferir('6. corrigido: as entradas voltam a somar o boleto, e o valor fica igual', /Entradas\s*\+ R\$ 1\.388,88/.test(depois) && /Saídas\s*− R\$ 668,88/.test(depois),
  (depois.match(/Entradas.{0,60}/) || [''])[0]);

// ---- de novo: nada a mexer ----
await page.waitForSelector('#folha .botao-reler:not([disabled])', { timeout: 20000 });
await page.click('#folha .botao-reler');
await page.waitForSelector('#dialogoFundo.aberta', { timeout: 60000 }); await page.waitForTimeout(500);
const segunda = limpo(await page.textContent('#dialogoFundo'));
conferir('7. relendo outra vez, tudo certo e nada muda', /Está tudo certo/.test(segunda) && /Nada foi mudado/.test(segunda), segunda);

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

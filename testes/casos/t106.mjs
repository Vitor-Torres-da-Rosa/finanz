// A folha do registro mostra o total, e de onde ele vem.
//
// A lista de registros dizia R$ 1.350,00 (produto + acréscimo do
// parcelamento, juntados na 5.11.2) e, ao tocar na linha, a folha abria
// com R$ 1.000,00. Dois números para a mesma coisa, sem nada explicando
// a diferença.
//
// Pedido do Vitor em 20/10/2026: "quero que apareça o total quando clica
// e descriminados embaixo os valores pq o total é esse". E, no mesmo
// pedido, que esta folha use o cartão de "Editar pagamento" — um lugar
// só, onde o que está escrito é o que se edita.
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

// Onde termina, em pixels, o texto da coluna da direita de cada linha do
// cartão. Linha só de leitura e rótulo de seletor dão para medir com um
// Range; campo de texto é alinhado à direita, então o texto acaba na borda
// menos o padding. O campo de data fica de fora: o ícone é nativo e o
// navegador não devolve a medida dele de um jeito confiável.
const direitasDoCartao = () => page.evaluate(() => {
  function fimDoTexto(el) {
    const n = [...el.childNodes].find((x) => x.nodeType === 3 && x.textContent.trim());
    if (!n) return null;
    const r = document.createRange(); r.selectNodeContents(n);
    return r.getBoundingClientRect().right;
  }
  const fora = [];
  document.querySelectorAll('#folha .cartao .parcela-linha').forEach((l) => {
    const q = l.querySelector('.q'), v = l.querySelector('.v');
    if (!q || !v) return;
    const campo = v.querySelector('input');
    const rotulo = v.querySelector('.selecao .rotulo-valor');
    let dir = null;
    if (rotulo) dir = fimDoTexto(rotulo);
    else if (campo && campo.type === 'date') return;
    else if (campo) {
      const r = campo.getBoundingClientRect();
      dir = r.right - parseFloat(getComputedStyle(campo).paddingRight);
    } else dir = fimDoTexto(v);
    if (dir != null) fora.push({ rotulo: q.textContent.trim(), dir: Math.round(dir * 10) / 10 });
  });
  return fora;
});

const porDinheiro = async (loc, d) => {
  await loc.click();
  for (let i = 0; i < 16; i++) await loc.press('Backspace');
  await loc.type(d);
  await page.waitForTimeout(300);
};
const escolher = async (r) => {
  await page.click(`#escolhaLista .escolha-item:has-text("${r}")`);
  await page.waitForTimeout(700);
};
// O campo deste rótulo, esteja ele dentro do cartão (formato novo) ou
// solto na folha (formato antigo). Sem isto o teste morria na metade no
// código antigo e as verificações do total nunca eram provadas vermelhas.
const campoDe = async (rotulo) => {
  const dentro = page.locator(`#folha .parcela-linha.edita:has(.q:text-is("${rotulo}")) input`);
  if (await dentro.count()) return dentro.first();
  return page.locator(`#folha .campo:has(label:text-is("${rotulo}")) input`).first();
};
// O número grande como a pessoa o vê, seja ele um campo (formato antigo)
// ou um número calculado (formato novo). Lendo só o textContent, no código
// antigo vinha vazio e a verificação ficava vermelha pelo motivo errado.
const numeroGrande = async () => {
  const l = folha().locator('.valor-grande').first();
  const t = limpo(await l.textContent());
  if (t) return t;
  return limpo(await l.inputValue().catch(() => ''));
};
// O que a linha do cartão deste rótulo mostra. Linha só de leitura traz o
// número no texto; linha editável traz num campo, então leio os dois.
const linhaDoCartao = async (rotulo) => {
  const l = page.locator(`#folha .parcela-linha:has(.q:text-is("${rotulo}"))`).first();
  if (!(await l.count())) return '';
  let t = limpo(await l.textContent());
  const campos = l.locator('input');
  for (let i = 0; i < (await campos.count()); i++) t += ' ' + limpo(await campos.nth(i).inputValue());
  return limpo(t);
};

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t106-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// cliente + registro de R$ 1.000
await page.click('#telaInicio .segmentos button:has-text("Empreendedor")'); await page.waitForTimeout(900);
await page.click('#fab'); await page.waitForTimeout(800);
await folha().locator('input.entrada[type=text]').nth(0).fill('Fabi do juliano');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1100);
await page.click('#telaInicio .linha-alvo:has-text("Fabi do juliano")'); await page.waitForTimeout(1000);

// --- 1. a folha de registro NOVO já vem no formato de cartão ---
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(900);
conferir('1. registro novo: o valor combinado é o número grande',
  (await folha().locator('.campo:has(label:text-is("Valor combinado")) .valor-grande').count()) === 1);
conferir('2. registro novo: sem a linha de total (seria o mesmo número duas vezes)',
  !/Total com o acréscimo/.test(limpo(await page.textContent('#folha'))));
const editaveisNovo = await folha().locator('.parcela-linha.edita').count();
conferir('3. registro novo: tipo, o que foi, data e observação viraram linhas do cartão',
  editaveisNovo === 4, editaveisNovo + ' linha(s)');
conferir('4. registro novo: "Gerenciar tipos…" é opção do seletor, não um lápis ao lado',
  (await folha().locator('.linha-dupla-campo').count()) === 0);
await page.screenshot({ path: dir+'/r01-novo-registro-cartao.png', fullPage: true });

await porDinheiro(folha().locator('.valor-grande'), '100000');
await (await campoDe('O que foi')).fill('Celular');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);

// parcela em 4x com total maior: nasce o acréscimo de R$ 350
await page.click('#dialogoAcoes button:has-text("Combinar parcelas")'); await page.waitForTimeout(1500);
await page.click('#folha .campo:has-text("Em quantas vezes") .selecao'); await page.waitForTimeout(700);
await escolher('4x');
await porDinheiro(page.locator('#folha .campo:has-text("Total a cobrar") input'), '135000');
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(1000);
await page.click('#dialogoAcoes button >> nth=0'); await page.waitForTimeout(2500);

// --- 2. a lista diz 1.350; a folha tem que dizer o mesmo ---
await page.click('#folha button:has-text("Registros")'); await page.waitForTimeout(1000);
const naLista = limpo(await page.textContent('#folha'));
conferir('5. a lista mostra o total de R$ 1.350,00', /1\.350,00/.test(naLista));

await page.click('#folha .linha:has-text("Celular")'); await page.waitForTimeout(1200);
const grande = await numeroGrande();
conferir('6. ao abrir, o número grande é o total da lista', grande === 'R$ 1.350,00', grande);
conferir('7. e ele está rotulado como total',
  /TOTAL COM O ACRÉSCIMO|Total com o acréscimo/i.test(limpo(await page.textContent('#folha'))));

const lCombinado = await linhaDoCartao('Valor combinado');
const lAcrescimo = await linhaDoCartao('Acréscimo do parcelamento');
conferir('8. embaixo, a linha do valor combinado',
  /R\$ 1\.000,00/.test(lCombinado), lCombinado || '(não achei a linha)');
conferir('9. embaixo, a linha do acréscimo',
  /R\$ 350,00/.test(lAcrescimo), lAcrescimo || '(não achei a linha)');
conferir('10. 1.000 + 350 é o total: a conta fecha na tela',
  /R\$ 1\.000,00/.test(lCombinado) && /R\$ 350,00/.test(lAcrescimo) && grande === 'R$ 1.350,00');

const editaveis = await folha().locator('.parcela-linha.edita').count();
conferir('11. tipo, o que foi, data, observação e o valor combinado no cartão',
  editaveis === 5, editaveis + ' linha(s) editável(is)');
conferir('12. nenhum rótulo repetido fora do cartão',
  (await folha().locator('.campo > label').count()) === 1,
  (await folha().locator('.campo > label').allTextContents()).join(' | '));

// A coluna da direita tem de ser uma reta: o ▾ do seletor media 6px e o
// recuo das linhas sem ícone, 17px — cinco pixels de diferença que faziam
// o cartão parecer torto.
const direitas = await direitasDoCartao();
console.log('fim do texto por linha:', JSON.stringify(direitas));
const xs = direitas.map((d) => d.dir);
// Três tipos de controle diferentes na mesma conta: linha só de leitura,
// campo de texto e seletor. Se qualquer um deles sair da reta, cai aqui.
conferir('13. a coluna da direita do cartão é uma reta só',
  xs.length >= 3 && Math.max(...xs) - Math.min(...xs) < 1,
  direitas.map((d) => d.rotulo + '=' + d.dir).join(', '));
await page.screenshot({ path: dir+'/r02-registro-total-discriminado.png', fullPage: true });

// --- 3. mexer no valor combinado recalcula o total na hora ---
await porDinheiro(await campoDe('Valor combinado'), '120000');
const grande2 = await numeroGrande();
conferir('14. mudando o combinado para 1.200, o total vira 1.550 sem recarregar',
  grande2 === 'R$ 1.550,00', grande2);
await page.screenshot({ path: dir+'/r03-total-recalculado.png', fullPage: true });

// --- 4. e salvar guarda o que está escrito ---
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2000);
const depois = limpo(await page.textContent('#folha'));
conferir('15. a lista passa a mostrar R$ 1.550,00', /1\.550,00/.test(depois),
  (depois.match(/Celular[\s\S]{0,120}/) || ['(não achei)'])[0]);
conferir('16. o tipo não se perdeu no caminho', /Serviço|Venda/.test(depois));
await page.screenshot({ path: dir+'/r04-lista-depois-de-salvar.png', fullPage: true });

// --- 5. a folha da parcela em aberto virou o mesmo cartão ---
// Era a outra folha do Empreendedor com a mesma forma: um valor em cima e
// três atributos embaixo, cada um no seu bloco solto, com os recados longe
// da data que eles explicam.
await page.click('#folha button:has-text("Parcelas")'); await page.waitForTimeout(1200);
await page.click('#folha .linha >> nth=0'); await page.waitForTimeout(1400);
const naParcela = limpo(await page.textContent('#folha'));
console.log('folha da parcela:', naParcela.slice(0, 220));
conferir('17. a folha da parcela abre no formato de cartão',
  (await folha().locator('.parcela-linha.edita').count()) === 3,
  (await folha().locator('.parcela-linha.edita .q').allTextContents()).join(', '));
conferir('18. nada ficou solto fora do cartão além do valor',
  (await folha().locator('.campo > label').count()) === 1,
  (await folha().locator('.campo > label').allTextContents()).join(' | '));
conferir('19. e o recado de contexto foi para dentro do cartão',
  (await folha().locator('.cartao .linha-nota').count()) >= 1, naParcela.slice(0, 200));
const direitasP = await direitasDoCartao();
const xsP = direitasP.map((d) => d.dir);
conferir('20. a coluna da direita da parcela também é uma reta',
  xsP.length >= 2 && Math.max(...xsP) - Math.min(...xsP) < 1,
  direitasP.map((d) => d.rotulo + '=' + d.dir).join(', '));
// Rótulo que quebra em duas linhas desencontra a altura das linhas e
// estraga o cartão. Em 390px de largura, nenhum deles pode passar disso.
const alturas = await page.evaluate(() => [...document.querySelectorAll('#folha .cartao .parcela-linha .q')]
  .map((q) => ({ t: q.textContent.trim(), linhas: Math.round(q.getBoundingClientRect().height / parseFloat(getComputedStyle(q).lineHeight)) })));
conferir('21. nenhum rótulo do cartão quebra em duas linhas',
  alturas.every((a) => a.linhas <= 1), JSON.stringify(alturas));
await page.screenshot({ path: dir+'/r05-parcela-em-cartao.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: o total aparece e vem discriminado embaixo');

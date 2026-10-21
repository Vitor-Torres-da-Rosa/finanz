// Parcelado direto: o acréscimo é o preço de esperar, então conta uma vez
// para cada parcela depois da primeira. O à vista sai pelo total do
// orçamento e cada opção sobe um degrau.
//
// Orçamento de R$ 800,00, até 3x, R$ 100,00 de acréscimo por parcela:
//   à vista  R$   800,00
//   2x       R$   900,00        2 de R$ 450,00
//   3x       R$ 1.000,00        3 de R$ 333,34 (a última, menor, R$ 333,32)
import { chromium, dir, ENDERECO } from '../comum.mjs';
import fs from 'node:fs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, acceptDownloads:true });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t86'+Date.now()+'-'+process.pid+'@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
await page.click('#telaInicio button:has-text("Empreendedor")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .fab, #telaInicio button:has-text("Cadastrar primeiro cliente")'); await page.waitForTimeout(1000);
await page.locator('#folha input.entrada').nth(0).fill('Gustavo Appelt');
await page.locator('#folha input[type=tel]').first().fill('47984213185');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);

await page.click('#telaInicio .linha-alvo:has-text("Gustavo Appelt")'); await page.waitForTimeout(1400);
await page.click('#folha .aba-cliente button:has-text("Orçamentos")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Simular serviço")'); await page.waitForTimeout(1200);

await page.locator('#folha .campo:has-text("Descrição") input').fill('TV INFINITY 32*');
await page.locator('#folha .campo:has-text("Mão de obra") input').fill('80000');
await page.waitForTimeout(600);

await page.click('#folha .lembrar:has-text("Parcelar direto")'); await page.waitForTimeout(900);
await page.click('#folha .campo:has-text("Em até quantas vezes") .selecao'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("até 3x")'); await page.waitForTimeout(800);
await page.click('#folha .campo:has-text("Acréscimo") .selecao'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Acrescentar R$ por parcela")'); await page.waitForTimeout(800);
await page.locator('#folha .campo:has-text("Quantos reais por parcela") input').fill('10000');
await page.waitForTimeout(800);

const resumo = limpo(await page.textContent('#folha .cartao:has-text("Como fica para o cliente")'));
console.log('resumo na tela:', resumo.slice(resumo.indexOf('Parcelado direto')));
conferir('1. o resumo mostra o à vista pelo total do orçamento (R$ 800,00)',
  /À vistasem acréscimo — é o total do orçamentoR\$ 800,00/.test(resumo));
conferir('2. o resumo diz que o acréscimo entra a partir de 2x',
  /acréscimo entra a partir de 2x/.test(resumo));
await page.screenshot({ path: dir+'/w01-orcamento.png', fullPage: true });

await page.click('#folha .btn-ouro:has-text("Salvar orçamento")'); await page.waitForTimeout(1800);
// Esperar pelo elemento em vez de confiar no sono: com a suíte inteira em
// paralelo, salvar e redesenhar passava dos 1800ms e a leitura morria no
// tempo padrão de 30s sem ter nada a ver com o que o teste confere.
await page.waitForSelector('#folha .cartao:has-text("Como pagar")', { timeout: 60000 });
const comoPagar = limpo(await page.textContent('#folha .cartao:has-text("Como pagar")'));
console.log('como pagar:', comoPagar.slice(comoPagar.indexOf('Parcelado direto')));
conferir('3. à vista = R$ 800,00, o total do orçamento', /À vistasem acréscimoR\$ 800,00/.test(comoPagar));
conferir('4. 2x = R$ 900,00, um degrau acima do à vista (2 de R$ 450,00)',
  /2x2x de R\$ 450,00R\$ 900,00/.test(comoPagar));
conferir('5. 3x = R$ 1.000,00 (3 de R$ 333,34, a última menor)',
  /3x3x de R\$ 333,34 \(última R\$ 333,32\)R\$ 1\.000,00/.test(comoPagar));
conferir('6. os degraus são de R$ 100 em R$ 100 a partir do 2x',
  /À vistasem acréscimoR\$ 800,00.*?R\$ 900,00.*?R\$ 1\.000,00/.test(comoPagar));
await page.evaluate(() => {
  const c = document.querySelector('#folha .cartao:has(.rotulo)');
  const alvo = [...document.querySelectorAll('#folha .rotulo')].find(n => /Parcelado direto/.test(n.textContent));
  if (alvo) alvo.scrollIntoView({ block: 'start' });
});
await page.waitForTimeout(600);
await page.screenshot({ path: dir+'/w02-pronto.png' });

// E no PDF, que é o que o cliente abre.
const [dl] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#folha .btn-fantasma:has-text("Salvar o PDF no celular")')
]);
await dl.saveAs(dir + '/w-orcamento.pdf');
console.log('PDF salvo:', dl.suggestedFilename());

// O PDF é o que o cliente abre, então a conferência final é nele. Os fluxos
// de conteúdo saem sem compressão, então basta juntar os textos entre
// parênteses na ordem em que foram escritos.
const bruto = fs.readFileSync(dir + '/w-orcamento.pdf', 'latin1');
const fluxos = [...bruto.matchAll(/stream\r?\n([\s\S]*?)\r?\nendstream/g)].map(m => m[1]).join('\n');
const textoPdf = [...fluxos.matchAll(/\((?:\\.|[^\\()])*\)/g)]
  .map(m => m[0].slice(1, -1)).join(' | ');
const direto = limpo(textoPdf.slice(textoPdf.indexOf('Parcelado direto')));
console.log('no PDF:', direto.slice(0, 220));
conferir('7. no PDF, à vista = R$ 800,00', /à vista \| R\$ 800,00/.test(direto));
conferir('8. no PDF, 2x de R$ 450,00 dá R$ 900,00', /2x \| R\$ 450,00 \| R\$ 900,00/.test(direto));
conferir('9. no PDF, 3x de R$ 333,34 dá R$ 1.000,00', /3x \| R\$ 333,34 \| R\$ 1\.000,00/.test(direto));
conferir('10. no PDF não sobrou o R$ 1.100,00 do cálculo antigo', !/R\$ 1\.100,00/.test(direto));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: o à vista do parcelado direto é o preço combinado');

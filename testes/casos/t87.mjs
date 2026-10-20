// Parcelamento de cliente: a escada do acréscimo, e o registro de acréscimo
// que só pode existir enquanto o parcelamento existir.
//
// Registro de R$ 1.000,00 com R$ 100,00 de acréscimo por parcela:
//   1x R$ 1.000,00 · 2x R$ 1.100,00 · 3x R$ 1.200,00 · 4x R$ 1.300,00
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t87'+Date.now()+'-'+process.pid+'@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

// Campo de dinheiro é mascarado: o fill() do Playwright ACRESCENTA os
// dígitos em vez de trocar, e "fill('') antes" não resolve porque a
// máscara repõe o zero e o segundo fill soma por cima. Com a máquina
// folgada passava; com doze testes ao mesmo tempo virava R$ 100.000.135,00
// no lugar de R$ 1.350,00, e eu vinha tratando isso como flake de
// paralelismo. Não era: era este atalho.
const porDinheiro = async (campo, digitos) => {
  await campo.click();
  for (let i = 0; i < 16; i++) await campo.press('Backspace');
  await campo.type(digitos);
  await page.waitForTimeout(300);
};
const folhaFechou = () => page.waitForFunction(
  () => !document.getElementById('folha').classList.contains('aberta'), null, { timeout: 20000 });

// cliente e um registro de R$ 1.000,00
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
await page.click('#telaInicio button:has-text("Empreendedor")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .fab, #telaInicio button:has-text("Cadastrar primeiro cliente")'); await page.waitForTimeout(1000);
await page.locator('#folha input.entrada').nth(0).fill('Fabi do juliano');
await page.locator('#folha input[type=tel]').first().fill('51994923028');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await folhaFechou();

await page.click('#telaInicio .linha-alvo:has-text("Fabi do juliano")'); await page.waitForTimeout(1400);
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(1000);
await page.locator('#folha .campo:has-text("Valor combinado") input').fill('100000');
await page.locator('#folha input.entrada[type=text]').first().fill('Celular');
await page.screenshot({ path: dir+'/y09-registro.png', fullPage: true });
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2000);
console.log('depois de salvar o registro:', limpo(await page.textContent('#folha')).slice(0, 200));

// O app oferece combinar parcelas assim que o registro é salvo.
await page.click('#dialogoAcoes button:has-text("Combinar parcelas")'); await page.waitForTimeout(1500);
console.log('valor sugerido:', await page.locator('#folha .campo:has-text("Valor a combinar") input').inputValue());
await page.click('#folha .campo:has-text("Acréscimo") .selecao'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("Acrescentar R$ por parcela")'); await page.waitForTimeout(800);
await page.locator('#folha .campo:has-text("Quantos reais por parcela") input').fill('10000');
await page.waitForTimeout(700);

const totalCom = async (v) => {
  await page.click('#folha .campo:has-text("Em quantas vezes") .selecao'); await page.waitForTimeout(600);
  await page.click(`#escolhaLista .escolha-item:has-text("${v}")`); await page.waitForTimeout(800);
  return limpo(await page.locator('#folha .campo:has-text("Total a cobrar") input').inputValue());
};
const escada = {};
for (const [rotulo, opcao] of [['1x','À vista (1x)'], ['2x','2x'], ['3x','3x'], ['4x','4x']]) {
  escada[rotulo] = await totalCom(opcao);
}
console.log('escada:', JSON.stringify(escada));
conferir('1. 1x = R$ 1.000,00, o valor combinado', /1\.000,00/.test(escada['1x']), escada['1x']);
conferir('2. 2x = R$ 1.100,00', /1\.100,00/.test(escada['2x']), escada['2x']);
conferir('3. 3x = R$ 1.200,00', /1\.200,00/.test(escada['3x']), escada['3x']);
conferir('4. 4x = R$ 1.300,00 (e não R$ 1.400,00)', /1\.300,00/.test(escada['4x']), escada['4x']);
await page.screenshot({ path: dir+'/y10-escada.png', fullPage: true });

await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(2000);
const parcelas = await page.$$eval('#folha .linha', ns => ns.map(n => n.textContent.replace(/\s+/g,' ')));
console.log('parcelas:', parcelas.slice(0, 4));
conferir('5. 4 parcelas de R$ 325,00', parcelas.filter(t => /325,00/.test(t)).length === 4);

await page.click('#folha .aba-cliente button:has-text("Registros")'); await page.waitForTimeout(900);
const registros = limpo(await page.textContent('#folha'));
// Desde a 5.11.2 o acréscimo não é mais uma linha própria: ele é somado
// ao registro que o gerou e aparece ali dentro. O dinheiro é o mesmo; o
// que mudou é não parecer uma venda que o cliente nunca fez.
conferir('6. o acréscimo de R$ 300,00 entrou no registro que o gerou',
  /com R\$ 300,00 de acréscimo/.test(registros) && !/Acréscimo do parcelamento em 4x/.test(registros),
  (registros.match(/com R\$[^·]*de acréscimo/) || ['(não achei)'])[0]);
await page.screenshot({ path: dir+'/y11-registros.png', fullPage: true });

// --- apagar as parcelas leva o acréscimo junto ---
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
await page.click('#folha .btn-perigo:has-text("Apagar as 4 parcelas")'); await page.waitForTimeout(900);
const aviso = limpo(await page.textContent('#dialogoTexto'));
console.log('aviso:', aviso.slice(0, 260));
conferir('7. a confirmação avisa que o acréscimo sai junto', /acréscimo do parcelamento, de R\$ 300,00/.test(aviso));
await page.click('#dialogoAcoes button:has-text("Apagar tudo")'); await page.waitForTimeout(2000);
await page.click('#folha .aba-cliente button:has-text("Registros")'); await page.waitForTimeout(900);
const depois = limpo(await page.textContent('#folha'));
conferir('8. o acréscimo saiu junto com as parcelas', !/Acréscimo do parcelamento/.test(depois));
conferir('9. o registro do cliente continuou', /Celular/.test(depois));
conferir('10. o total voltou a ser R$ 1.000,00', /TOTAL R\$ 1\.000,00|R\$ 1\.000,00/.test(depois));
await page.screenshot({ path: dir+'/y12-depois.png', fullPage: true });

// --- só o total escrito na mão, sem usar o campo de acréscimo ---
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
await page.click('#folha .btn-ouro:has-text("Combinar parcelas")'); await page.waitForTimeout(1200);
await page.click('#folha .campo:has-text("Em quantas vezes") .selecao'); await page.waitForTimeout(600);
await page.click('#escolhaLista .escolha-item:has-text("4x")'); await page.waitForTimeout(800);
const campoTotal = page.locator('#folha .campo:has-text("Total a cobrar") input');
await porDinheiro(campoTotal, '140000');
await page.waitForTimeout(800);
console.log('resumo com total na mão:', limpo(await page.textContent('#folha .cartao')).slice(0, 200));
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(2000);
await page.click('#folha .aba-cliente button:has-text("Registros")'); await page.waitForTimeout(900);
const comTotal = limpo(await page.textContent('#folha'));
console.log('registros:', comTotal.slice(comTotal.indexOf('Celular') - 200, comTotal.indexOf('Celular') + 60));
conferir('11. escrever o total na mão também cria o acréscimo, de R$ 400,00',
  /com R\$ 400,00 de acréscimo/.test(comTotal),
  (comTotal.match(/com R\$[^·]*de acréscimo/) || ['(não achei)'])[0]);
await page.screenshot({ path: dir+'/y13-total-na-mao.png', fullPage: true });

// --- à vista com acréscimo: o nome não pode falar em parcelamento ---
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
await page.click('#folha .btn-perigo:has-text("Apagar as 4 parcelas")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Apagar tudo")'); await page.waitForTimeout(2000);
await page.click('#folha .btn-ouro:has-text("Combinar parcelas")'); await page.waitForTimeout(1200);
const totalAvista = page.locator('#folha .campo:has-text("Total a cobrar") input');
await porDinheiro(totalAvista, '110000');
await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(2000);
await page.click('#folha .aba-cliente button:has-text("Registros")'); await page.waitForTimeout(900);
const avista = limpo(await page.textContent('#folha'));
// O nome do acréscimo deixou de aparecer na tela quando ele passou a ser
// somado ao registro. O que dá para conferir daqui é o que a pessoa vê:
// o acréscimo existe, está no registro certo, e não sobrou linha solta.
conferir('12. à vista com acréscimo, ele também entra no registro',
  /de acréscimo/.test(avista) && !/Acréscimo do parcelamento/.test(avista)
  && !/Acréscimo sobre o valor combinado/.test(avista),
  (avista.match(/com R\$[^·]*de acréscimo/) || ['(não achei)'])[0]);
await page.screenshot({ path: dir+'/y14-avista.png', fullPage: true });

// --- só aumentar o "Valor a combinar" acima do registro também é acréscimo ---
// Sem isso a ficha ficava com as parcelas somando mais que o total do cliente:
// 4 de R$ 337,50 = R$ 1.350,00 contra um Total de R$ 1.000,00.
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
await page.click('#folha .btn-perigo:has-text("Apagar a")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Apagar tudo")'); await page.waitForTimeout(2000);
await page.click('#folha .btn-ouro:has-text("Combinar parcelas")'); await page.waitForTimeout(1200);
const campoValor = page.locator('#folha .campo:has-text("Valor a combinar") input');
await porDinheiro(campoValor, '135000');
await page.waitForTimeout(600);
await page.click('#folha .campo:has-text("Em quantas vezes") .selecao'); await page.waitForTimeout(600);
await page.click('#escolhaLista .escolha-item:has-text("4x")'); await page.waitForTimeout(800);
const resumoMaior = limpo(await page.textContent('#folha .cartao'));
conferir('13. o resumo avisa do acréscimo antes de confirmar',
  /Acréscimo de R\$ 350,00 sobre os R\$ 1\.000,00/.test(resumoMaior));
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(2000);
const fichaMaior = limpo(await page.textContent('#folha'));
console.log('ficha:', fichaMaior.slice(0, 120));
conferir('14. o total do cliente passou a bater com as parcelas (R$ 1.350,00)',
  /TotalR\$ 1\.350,00/.test(fichaMaior), (fichaMaior.match(/TotalR\$ [\d.,]+/) || ['?'])[0]);
await page.click('#folha .aba-cliente button:has-text("Registros")'); await page.waitForTimeout(900);
const regMaior = limpo(await page.textContent('#folha'));
conferir('15. a diferença de R$ 350,00 entrou no registro',
  /com R\$ 350,00 de acréscimo/.test(regMaior),
  (regMaior.match(/com R\$[^·]*de acréscimo/) || ['(não achei)'])[0]);
conferir('16. não sobrou "Acertar as parcelas" para desencontro',
  !/Acertar as parcelas/.test(limpo(await page.textContent('#folha'))));
await page.screenshot({ path: dir+'/y15-valor-maior.png', fullPage: true });

// --- parcelar só uma parte do registro não pode virar acréscimo ---
await page.click('#folha .aba-cliente button:has-text("Parcelas")'); await page.waitForTimeout(900);
await page.click('#folha .btn-perigo:has-text("Apagar a")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Apagar tudo")'); await page.waitForTimeout(2000);
await page.click('#folha .btn-ouro:has-text("Combinar parcelas")'); await page.waitForTimeout(1200);
const campoParcial = page.locator('#folha .campo:has-text("Valor a combinar") input');
await porDinheiro(campoParcial, '40000');
await page.waitForTimeout(800);
const resumoParcial = limpo(await page.textContent('#folha .cartao'));
conferir('17. parcelar parte do registro não inventa acréscimo nem desconto',
  !/Acréscimo de/.test(resumoParcial) && !/Desconto de/.test(resumoParcial),
  resumoParcial.slice(0, 80));

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: escada do acréscimo e registro amarrado ao parcelamento');

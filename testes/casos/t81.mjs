// Orçamento com tipo, outros valores, formas de pagamento e parcelado direto.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
import { irParaClientes } from '../comum.mjs';
import fs from 'fs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2, acceptDownloads:true });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
page.on('console', m => { if (m.type()==='error') console.log('CONSOLE:', m.text()); });
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('l81'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
await irParaClientes(page); await page.waitForTimeout(1200);
await page.click('#telaInicio .fab, #telaInicio button:has-text("Cadastrar primeiro cliente")'); await page.waitForTimeout(1000);
await page.locator('#folha input.entrada').nth(0).fill('Daniela Torres');
await page.locator('#folha input[type=tel]').first().fill('51985010000');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);

await page.click('#telaInicio .linha-alvo:has-text("Daniela Torres")'); await page.waitForTimeout(1400);
await page.click('#folha .aba-cliente button:has-text("Orçamentos")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Simular serviço")'); await page.waitForTimeout(1000);

console.log('1. primeiro campo:', await page.locator('#folha .campo').first().textContent());
// "O que é" -> Outro / adicionar
await page.click('#folha .campo:has-text("O que é") .selecao'); await page.waitForTimeout(700);
console.log('2. opções:', await page.$$eval('#escolhaLista .escolha-item .txt', ns=>ns.map(n=>n.textContent.replace(/\s+/g,' '))));
await page.click('#escolhaLista .escolha-item:has-text("Outro / adicionar")'); await page.waitForTimeout(900);
console.log('3. pediu o nome:', await page.textContent('#folhaTitulo'));
await page.locator('#folha input.entrada').first().fill('Venda');
await page.click('#folha .btn-ouro'); await page.waitForTimeout(1200);
// como "Venda" já existe, ele apenas seleciona
console.log('4. tipo agora:', await page.textContent('#folha .campo:has-text("O que é") .selecao'));

await page.locator('#folha .campo:has-text("Descrição") input').fill('Venda de um carro');
// Outros valores
const cards = page.locator('#folha .cartao');
await page.click('#folha .cartao-topo:has-text("Outros valores") button'); await page.waitForTimeout(700);
const outros = page.locator('#folha .cartao:has-text("Outros valores") .linha-item-orc');
await outros.nth(0).locator('input').nth(0).fill('Valor de venda');
await outros.nth(0).locator('input').nth(1).fill('1000000');
await page.waitForTimeout(500);
console.log('5. preços com só o valor de venda:');
console.log('   ', (await page.textContent('#folha .cartao:has-text("Como fica para o cliente")')).replace(/\s+/g,' ').slice(0,220));

// formas de pagamento: as taxas moram na tela de taxas, aqui só o desconto
await page.locator('#folha .campo:has-text("Desconto no dinheiro") input').fill('15');
await page.waitForTimeout(600);
console.log('6. com 15% de desconto:', (await page.textContent('#folha .cartao:has-text("Como fica para o cliente")')).replace(/\s+/g,' ').slice(0,160));
await page.screenshot({ path: dir+'/o01-orcamento.png', fullPage: true });

// parcelar direto
await page.click('#folha .lembrar:has-text("Parcelar direto")'); await page.waitForTimeout(900);
console.log('7. abriu o parcelado direto?', await page.locator('#folha .cartao:has-text("Parcelado direto")').count());
await page.locator('#folha .campo:has-text("Entrada") input').fill('200000');
await page.click('#folha .campo:has-text("Em até quantas vezes") .selecao'); await page.waitForTimeout(700);
await page.click('#escolhaLista .escolha-item:has-text("até 6x")'); await page.waitForTimeout(800);
console.log('8. preços com direto:', (await page.textContent('#folha .cartao:has-text("Como fica para o cliente")')).replace(/\s+/g,' ').slice(0,340));
await page.screenshot({ path: dir+'/o02-direto.png', fullPage: true });

await page.click('#folha .btn-ouro:has-text("Salvar orçamento")'); await page.waitForTimeout(1600);
console.log('9. pronto:', await page.textContent('#folhaTitulo'));
console.log('   como pagar:', (await page.textContent('#folha .cartao:has-text("Como pagar")')).replace(/\s+/g,' ').slice(0,260));
await page.screenshot({ path: dir+'/o03-pronto.png', fullPage: true });

const [dl] = await Promise.all([
  page.waitForEvent('download'),
  page.click('#folha .btn-fantasma:has-text("Salvar o PDF no celular")')
]);
await dl.saveAs(dir + '/o-orcamento.pdf');
console.log('10. PDF:', dl.suggestedFilename(), fs.statSync(dir+'/o-orcamento.pdf').size, 'bytes');

// as taxas ficam guardadas para o próximo orçamento
for (let i = 0; i < 4 && !(await page.locator('#folha .aba-cliente').count()); i++) {
  await page.goBack(); await page.waitForTimeout(1000);
}
console.log('   voltei para:', await page.textContent('#folhaTitulo').catch(()=>'(fechada)'));
await page.click('#folha .aba-cliente button:has-text("Orçamentos")'); await page.waitForTimeout(800);
await page.click('#folha .btn-ouro:has-text("Simular serviço")'); await page.waitForTimeout(1400);
const guardadas = await page.evaluate(() => {
  const val = (t) => {
    const c = [...document.querySelectorAll('#folha .campo')].find(x => x.textContent.includes(t));
    return c ? c.querySelector('input, .selecao').textContent || c.querySelector('input').value : '-';
  };
  const pega = (t) => {
    const c = [...document.querySelectorAll('#folha .campo')].find(x => x.textContent.includes(t));
    const i = c && c.querySelector('input');
    return i ? i.value : (c ? c.querySelector('.selecao').textContent.trim() : '-');
  };
  return { desconto: pega('Desconto no dinheiro'), avista: pega('maquininha à vista'),
           parcelado: pega('maquininha parcelado'), parcelas: pega('Parcelas no cartão') };
});
console.log('11. já vem preenchido no próximo:', JSON.stringify(guardadas));
await browser.close();

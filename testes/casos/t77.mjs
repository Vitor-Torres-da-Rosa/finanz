// Prova do "apagar tudo desta conta": serve para extrato que entrou errado
// antes de existir o registro de importações.
import { chromium, dir, amostras, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(ENDERECO, { waitUntil:'networkidle' });
await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('l77'+Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// restaura um estado como o que o Vitor tem: saldo estourado, sem registro
// de importação (veio de uma versão antiga)
const hoje = new Date().toISOString().slice(0,10);
await page.evaluate((hoje) => new Promise(res => {
  const l = [];
  for (let i = 0; i < 6; i++) {
    l.push({ id:'x'+i, tipo:'saida', valor: 3013580, data: hoje, contaId:'inter-t77',
             categoria:'Outros', descricao:'Pagamento efetuado: PAGAMENTO' });
  }
  l.push({ id:'y1', tipo:'entrada', valor: 500000, data: hoje, contaId:'c6', categoria:'Venda', descricao:'Salário' });
  const dados = { contas:[{id:'inter-t77',nome:'Banco Inter',tipo:'Conta corrente',saldoInicial:0},
                          {id:'c6',nome:'C6 Bank',tipo:'Conta corrente',saldoInicial:0}], lancamentos:l };
  const f = new File([JSON.stringify({app:'caixa', dados})], 'b.json', {type:'application/json'});
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 700);
}), hoje);
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(2500);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1500);
console.log('1. patrimônio:', (await page.textContent('#telaInicio .valorao')).replace(/\s+/g,' '));
console.log('   tela:', (await page.textContent('#telaInicio')).replace(/\s+/g,' ').slice(0,300));
await page.screenshot({ path: dir+'/i05-dbg.png', fullPage:true });
await page.click('#telaInicio *:has-text("Banco Inter") >> nth=-1'); await page.waitForTimeout(1200);
console.log('2. saldo Inter:', await page.textContent('#folha .valorao'));
await page.evaluate(() => { const b = document.querySelector('#folha .botao-saldo-correto'); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); }); await page.waitForTimeout(400);
await page.click('#folha .btn-ouro:has-text("Conferir esta conta")'); await page.waitForTimeout(1400);
console.log('3. repetidos apontados?', await page.locator('#folha .rotulo:has-text("Possíveis repetidos")').count());
console.log('4. aviso de importações:', await page.$$eval('#folha .linha-nota', ns=>ns.map(n=>n.textContent).filter(t=>/antes desta versão/.test(t))));
await page.evaluate(() => { document.getElementById('folha').scrollTop = 99999; });
await page.waitForTimeout(400);
await page.screenshot({ path: dir+'/i05-recomecar.png' });
await page.click('#folha .btn-vermelho:has-text("Apagar tudo desta conta")'); await page.waitForTimeout(800);
console.log('5. pergunta:', await page.textContent('#dialogoTitulo'), '|', (await page.textContent('#dialogoTexto')).replace(/\s+/g,' ').slice(0,90));
await page.click('#dialogoAcoes button:has-text("Apagar tudo")'); await page.waitForTimeout(2200);
console.log('6. Inter depois:', await page.$$eval('#folha .conf-item', ns=>ns.map(n=>n.textContent.replace(/\s+/g,' ')).slice(0,1)));
await page.click('#folha .btn-fechar, #folha [aria-label="Fechar"]').catch(()=>{});
await page.keyboard.press('Escape'); await page.waitForTimeout(900);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1500);
const inicio = (await page.textContent('#telaInicio')).replace(/\s+/g,' ');
console.log('7. C6 continua intacto?', /C6 Bank/.test(inicio), '| patrimônio:', (await page.textContent('#telaInicio .valorao')));
await page.screenshot({ path: dir+'/i06-limpo.png' });
await browser.close();

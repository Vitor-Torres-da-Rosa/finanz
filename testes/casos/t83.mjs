// A tela de análise: nota de saúde, achados por prioridade, próxima ação,
// e — o principal — nada afirmado sem dado que sustente.
import { chromium, dir, ENDERECO, abrirAnalise } from '../comum.mjs';
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t83' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// --- 1) conta nova: não pode inventar nota nenhuma ---
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
const vazio = (await page.textContent('#telaMais')).replace(/\s+/g,' ');
console.log('1. sem dados:', /Conhecendo o seu padr/.test(vazio) ? 'diz que está conhecendo (certo)' : 'ALGO INVENTADO');
console.log('   mostrou nota /100?', /\/100/.test(vazio) ? 'SIM (errado)' : 'não (certo)');
await page.screenshot({ path: dir+'/r01-sem-dados.png', fullPage: true });

// --- 2) sete meses de histórico, com cartão e recorrentes ---
await page.evaluate(() => new Promise(res => {
  const l = []; let n = 0;
  const hoje = new Date();
  const mes = (v) => { const d = new Date(hoje.getFullYear(), hoje.getMonth() - v, 12);
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-12'; };
  for (let m = 6; m >= 0; m--) {
    const data = mes(m);
    l.push({ id:'e'+(n++), tipo:'entrada', valor: 800000, data, contaId:'cc', categoria:'Salário', descricao:'Salário' });
    l.push({ id:'a-t83'+(n++), tipo:'saida', valor: 120000, data, contaId:'cc', categoria:'Moradia', descricao:'Aluguel' });
    l.push({ id:'f'+(n++), tipo:'saida', valor: m === 0 ? 180000 : 65000, data, contaId:'cartao', categoria:'Alimentação', descricao:'Mercado do bairro' });
    l.push({ id:'s'+(n++), tipo:'saida', valor: 3990, data, contaId:'cartao', categoria:'Assinaturas', descricao:'Streaming Mensal' });
    l.push({ id:'g'+(n++), tipo:'saida', valor: 8990, data, contaId:'cartao', categoria:'Lazer', descricao:'Academia Corpo' });
    l.push({ id:'p'+(n++), tipo:'saida', valor: (m === 0 ? 180000 : 65000) + 12980, data, contaId:'cc',
             categoria:'Outros', descricao:'PGTO FAT CARTAO' });
  }
  const dados = { contas:[{id:'cc',nome:'C6 Bank',tipo:'Conta corrente',saldoInicial:0},
                          {id:'cartao',nome:'C6 (cartão)',tipo:'Cartão de crédito',saldoInicial:0}],
                  lancamentos:l };
  const f = new File([JSON.stringify({app:'finanz', dados})], 'b.json', {type:'application/json'});
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1500);

console.log('2. saúde:', (await page.textContent('#telaMais .cartao.saude')).replace(/\s+/g,' ').slice(0,100));
await abrirAnalise(page);
const achados = await page.$$eval('#folha .cartao.achado', ns => ns.map(n => ({
  titulo: n.querySelector('.achado-titulo').textContent,
  valor: (n.querySelector('.achado-valor')||{}).textContent || '',
  acao: (n.querySelector('.btn-acao')||{}).textContent || ''
})));
console.log('3. achados na análise completa:', achados.length);
achados.forEach(a => console.log('   •', a.titulo, '|', a.valor, '|', a.acao));
// A "próxima ação" saiu junto com os avisos de Mais (25/11/2026).
await page.goBack(); await page.waitForTimeout(800);
for (let i = 0; i < 3 && await page.locator('#folha.aberta').count(); i++) { await page.goBack(); await page.waitForTimeout(500); }
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1200);
await page.screenshot({ path: dir+'/r02-analise.png', fullPage: true });

// --- 3) a fatura contada uma vez só ---
const somas = await page.evaluate(() => {
  const t = document.querySelector('#telaMais').textContent;
  return t.replace(/\s+/g,' ');
});
console.log('5. fala em fatura/cartão?', /cart[ãa]o|fatura/i.test(somas));

// --- 4) como calculamos ---
await page.click('#telaMais .cartao.saude .btn-mini'); await page.waitForTimeout(1000);
console.log('6. partes da nota:', await page.$$eval('#folha .parte-topo', ns=>ns.map(n=>n.textContent.replace(/\s+/g,' '))));
console.log('   fora da conta:', await page.$$eval('#folha p.linha-nota', ns=>ns.map(n=>n.textContent).filter(t=>/Fora da conta/.test(t))));
await page.screenshot({ path: dir+'/r03-como.png', fullPage: true });
await page.goBack(); await page.waitForTimeout(1200);

// --- 5) análise completa ---
await abrirAnalise(page);
console.log('7. análise completa, por prioridade:', await page.$$eval('#folha > div > .rotulo', ns=>ns.map(n=>n.textContent)));
console.log('   quantos achados:', await page.locator('#folha .cartao.achado').count());
await page.screenshot({ path: dir+'/r04-completa.png', fullPage: true });
await browser.close();

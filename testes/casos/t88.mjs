// Os sete acertos da 5.4.0, num teste só.
//
//  · quantidade, valor da parcela e total se completam entre si
//  · editar uma parcela leva o total do cliente junto
//  · o extrato de uma conta cheia abre na hora
//  · recado no dia do vencimento e quando o cliente está acabando de pagar
//  · meta não fala em percentual negativo e mostra os últimos meses
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
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t88'+Date.now()+'-'+process.pid+'@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g,' ').trim();
// Campo com máscara: apagar de verdade antes de digitar.
const digitar = async (el, texto) => {
  await el.click();
  for (let i = 0; i < 14; i++) await page.keyboard.press('Backspace');
  await page.keyboard.type(texto);
  await page.waitForTimeout(450);
};

// ---------- 1) os três campos do parcelamento ----------
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1000);
await page.click('#telaInicio button:has-text("Empreendedor")'); await page.waitForTimeout(1200);
await page.click('#telaInicio .fab, #telaInicio button:has-text("Cadastrar primeiro cliente")'); await page.waitForTimeout(1000);
await page.locator('#folha input.entrada').nth(0).fill('Fabi do juliano');
await page.locator('#folha input[type=tel]').first().fill('51994923028');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(1800);
await page.click('#telaInicio .linha-alvo:has-text("Fabi do juliano")'); await page.waitForTimeout(1400);
await page.click('#folha .btn-ouro:has-text("Nova venda ou serviço")'); await page.waitForTimeout(1000);
await page.locator('#folha .campo:has-text("Valor combinado") input').fill('100000');
await page.locator('#folha input.entrada[type=text]').first().fill('Celular');
await page.click('#folha .btn-ouro:has-text("Salvar")'); await page.waitForTimeout(2000);
await page.click('#dialogoAcoes button:has-text("Combinar parcelas")'); await page.waitForTimeout(1500);

const par = page.locator('#folha .campo:has-text("valor de cada parcela") input');
const tot = page.locator('#folha .campo:has-text("Total a cobrar") input');
const vez = page.locator('#folha .campo:has-text("Em quantas vezes") .selecao');
const porVezes = async (r) => {
  await vez.click(); await page.waitForTimeout(500);
  await page.click(`#escolhaLista .escolha-item:has-text("${r}")`); await page.waitForTimeout(700);
};
const lidos = async () => ({
  vezes: limpo(await vez.textContent()).replace('▾',''),
  parcela: await par.inputValue(),
  total: await tot.inputValue()
});

await digitar(page.locator('#folha .campo:has-text("Valor a combinar") input'), '90000');
await porVezes('3x'); await digitar(par, '30000');
let r = await lidos();
conferir('1. 3x + parcela R$ 300 dá total R$ 900', /900,00/.test(r.total), JSON.stringify(r));

await digitar(tot, '90000'); await porVezes('3x');
r = await lidos();
conferir('2. total R$ 900 + 3x dá parcela R$ 300', /300,00/.test(r.parcela), JSON.stringify(r));

await digitar(tot, '90000'); await digitar(par, '30000');
r = await lidos();
conferir('3. total R$ 900 + parcela R$ 300 dá 3x', r.vezes === '3x', JSON.stringify(r));

await digitar(tot, '100000'); await digitar(par, '30000');
r = await lidos();
const resumoQuebrado = limpo(await page.textContent('#folha .cartao'));
conferir('4. total R$ 1.000 + parcela R$ 300 dá 4x com a última de R$ 100',
  r.vezes === '4x' && /3x de R\$ 300,00 e a última de R\$ 100,00/.test(resumoQuebrado),
  JSON.stringify(r));

await digitar(tot, '100000'); await porVezes('3x');
const resumo3 = limpo(await page.textContent('#folha .cartao'));
conferir('5. nenhuma parcela passa do valor anunciado (a última é a menor)',
  /2x de R\$ 333,34 e a última de R\$ 333,32/.test(resumo3), resumo3.slice(0, 90));
await page.screenshot({ path: dir+'/u10-campos.png', fullPage: true });

// ---------- 2) editar uma parcela leva o total junto ----------
await digitar(tot, '100000'); await porVezes('4x');
await page.click('#folha .btn-ouro:has-text("Confirmar parcelamento")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(2000);
const totalDoCliente = async () =>
  (limpo(await page.textContent('#folha')).match(/TotalR\$ [\d.,]+/) || ['?'])[0];
conferir('6. 4x de R$ 250 fecha em R$ 1.000,00', /1\.000,00/.test(await totalDoCliente()));

// Baixar uma parcela não muda o que o cliente deve: o plano é que se
// reajusta em volta, virando uma parcela a mais no fim.
await page.click('#folha .linha:has-text("Parcela 1 de 4")'); await page.waitForTimeout(1200);
await digitar(page.locator('#folha .campo:has-text("Valor da parcela") input'), '10000');
await page.click('#folha .btn-fantasma:has-text("Salvar alterações")'); await page.waitForTimeout(2000);
conferir('7. baixar a parcela 1 para R$ 100 não mexe no total do cliente',
  /1\.000,00/.test(await totalDoCliente()), await totalDoCliente());
const plano = await page.$$eval('#folha .linha', ns => ns
  .filter(n => /Parcela \d+ de/.test(n.textContent))
  .map(n => ((n.textContent.replace(/\s+/g, ' ').match(/R\$ [\d.,]+$/)) || [''])[0]));
console.log('plano:', plano.join(' + '));
conferir('8. o plano cresceu para 5 parcelas e fecha nos R$ 1.000,00',
  plano.length === 5 && plano[0] === 'R$ 100,00', plano.join(' + '));
conferir('9. sumiu o aviso de desencontro',
  !/Acertar as parcelas/.test(limpo(await page.textContent('#folha'))));
await page.screenshot({ path: dir+'/u11-parcela.png', fullPage: true });

// ---------- 3) recados dos clientes ----------
await page.evaluate(() => new Promise(res => {
  const h = new Date();
  const d = (n) => { const x = new Date(h.getFullYear(), h.getMonth(), h.getDate()+n);
    return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0'); };
  const dados = {
    contas: [{ id:'cc-t88', nome:'Banco Inter', tipo:'Conta corrente', saldoInicial:0 }],
    lancamentos: [], pagamentos: [],
    clientes: [{ id:'c1', nome:'Gustavo Appelt', telefone:'47984213185' },
               { id:'c2', nome:'Daniela Torres', telefone:'51999990000' }],
    servicos: [{ id:'s1', clienteId:'c1', nome:'TV', tipo:'Venda', valor:90000, data:d(-30) },
               { id:'s2', clienteId:'c2', nome:'Instalação', tipo:'Serviço', valor:30000, data:d(-60) }],
    parcelas: [{ id:'q1', clienteId:'c1', servicoId:'s1', numero:1, total:3, valor:30000, vencimento:d(0) },
               { id:'q2', clienteId:'c1', servicoId:'s1', numero:2, total:3, valor:30000, vencimento:d(30) },
               { id:'q3', clienteId:'c1', servicoId:'s1', numero:3, total:3, valor:30000, vencimento:d(60) },
               { id:'q4', clienteId:'c2', servicoId:'s2', numero:3, total:3, valor:30000, vencimento:d(10) }]
  };
  const f = new File([JSON.stringify({app:'finanz', dados})], 'b.json', {type:'application/json'});
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1200);
await page.click('#telaInicio button:has-text("Empreendedor")'); await page.waitForTimeout(1500);
const recados = await page.$$eval('#telaInicio .cartao.recado', ns => ns.map(n => n.textContent.replace(/\s+/g,' ').trim()));
console.log('recados:', recados);
conferir('10. avisa o Pix que cai hoje',
  recados.some(t => /Hoje tem Pix caindo na conta: R\$ 300,00 de Gustavo/.test(t)));
conferir('11. sugere oferecer serviço novo na última parcela',
  recados.some(t => /Daniela está na última parcela/.test(t) && /oferecer o próximo serviço/.test(t)));
conferir('12. a linha do cliente mostra "cai hoje"',
  (await page.$$eval('#telaInicio .etiqueta', ns => ns.map(n => n.textContent))).indexOf('cai hoje') >= 0);
await page.screenshot({ path: dir+'/u12-recados.png', fullPage: true });

// ---------- 4) extrato de conta cheia ----------
await page.evaluate(() => new Promise(res => {
  const l = [];
  for (let i = 0; i < 4000; i++) {
    const d = new Date(2026, 8 - (i % 20), 1 + (i % 27));
    l.push({ id:'z'+i, tipo: i % 3 ? 'saida' : 'entrada', valor: 1000 + (i % 900),
             data: d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'),
             contaId: 'inter-t88', categoria:'Outros', descricao:'Movimento ' + i });
  }
  const dados = { contas:[{id:'inter-t88',nome:'Banco Inter',tipo:'Conta corrente',saldoInicial:0}], lancamentos:l };
  const f = new File([JSON.stringify({app:'finanz', dados})], 'b.json', {type:'application/json'});
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(4000);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1500);
await page.click('#telaInicio button:has-text("Visão geral")'); await page.waitForTimeout(2500);
const t0 = Date.now();
await page.click('#telaInicio .linha-alvo:has-text("Banco Inter")');
await page.locator('#folha .dia-cabecalho').first().waitFor({ timeout: 20000 });
const ms = Date.now() - t0;
const linhas = await page.locator('#folha .linha').count();
conferir('13. o extrato de 4.000 movimentos abre em menos de 250ms', ms < 250, ms + 'ms');
conferir('14. abre em bloco, não com tudo de uma vez', linhas > 0 && linhas < 400, linhas + ' linhas');
conferir('15. tem o botão de ver o resto',
  /Ver mais \d+ movimentos/.test(limpo(await page.textContent('#folha'))));
await page.screenshot({ path: dir+'/u13-extrato.png', fullPage: true });

// ---------- 5) a meta não fala em percentual negativo ----------
await page.evaluate(() => new Promise(res => {
  const l = []; let n = 0;
  const h = new Date();
  const mes = (v) => { const d = new Date(h.getFullYear(), h.getMonth() - v, 12);
    return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-12'; };
  const gasto = [70000, 130000, 62000];
  for (let m = 3; m >= 1; m--) {
    l.push({ id:'e'+(n++), tipo:'entrada', valor:100000, data:mes(m), contaId:'cc-m', categoria:'Salário', descricao:'Salário' });
    l.push({ id:'s'+(n++), tipo:'saida', valor:gasto[m-1], data:mes(m), contaId:'cc-m', categoria:'Moradia', descricao:'Aluguel' });
  }
  l.push({ id:'e'+(n++), tipo:'entrada', valor:100000, data:mes(0), contaId:'cc-m', categoria:'Salário', descricao:'Salário' });
  l.push({ id:'s'+(n++), tipo:'saida', valor:116000, data:mes(0), contaId:'cc-m', categoria:'Moradia', descricao:'Aluguel' });
  const dados = { contas:[{id:'cc-m',nome:'Banco Inter',tipo:'Conta corrente',saldoInicial:0}], lancamentos:l };
  const f = new File([JSON.stringify({app:'finanz', dados})], 'b.json', {type:'application/json'});
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1800);
const mais = limpo(await page.textContent('#telaMais'));
conferir('16. não aparece percentual negativo em lugar nenhum', !/-\d+%/.test(mais));
conferir('17. diz que guardou zero', /Você guardou zero este mês/.test(mais));
conferir('18. mostra os últimos meses embaixo', /Últimos meses: \w+ R\$ [\d.,]+ \(\d+%\)/.test(mais),
  (mais.match(/Últimos meses:.{0,70}/) || ['(sem histórico)'])[0]);
const cores = await page.$$eval('#telaMais .achado-nota span', ns => ns
  .map(n => n.style.color).filter(Boolean));
conferir('19. cada mês do histórico vem colorido pelo sinal',
  cores.length >= 3 && cores.some(c => /verde/.test(c)) && cores.some(c => /vermelho/.test(c)),
  cores.join(' | '));
conferir('20. o mês negativo aparece com o valor, não como zero',
  /\w+ −R\$ 300,00/.test(mais) && !/\w+ R\$ 0,00/.test(mais),
  (mais.match(/Últimos meses:.{0,70}/) || [''])[0]);
await page.screenshot({ path: dir+'/u14-meta.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo');

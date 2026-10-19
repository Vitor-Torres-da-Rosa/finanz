// "Ver lançamentos" tem de achar o que o próprio app acabou de listar.
//
// Em 19/10/2026 o Vitor tocou em "Ver lançamentos" numa despesa que se
// repete e caiu num "Nada encontrado". Três defeitos somados:
//
//  A) nomeDeOrigem() devolve a chave normalizada (maiúscula, sem acento,
//     espaços colapsados) e a busca jogava isso cru contra a descrição
//     original. Extrato de banco vem com espaço duplo, então a chave
//     "GUSTAVO SAAR" não achava "GUSTAVO  SAAR" no texto.
//  B) irParaTransacoes() sempre fixava o período no mês ativo. Uma
//     despesa que acontece "em 2 meses" pode não ter nada no mês atual.
//  C) transferência entre contas que o app identificou mas ainda não
//     confirmou entrava no total comprometido como se fosse conta a pagar.
import fs from 'node:fs';
import path from 'node:path';
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
const mesAtras = (n) => {
  const d = new Date(); d.setMonth(d.getMonth() - n); d.setDate(10);
  return d.toISOString().slice(0, 10);
};

const backup = {
  app: 'Finanz', versao: 3, em: new Date().toISOString(),
  dados: {
    versao: 3, perfil: { nome: 'Vitor' },
    contas: [
      { id: 'a1', nome: 'C6 Bank', tipo: 'Conta corrente', saldoInicial: 0, cor: '#E9B44C' },
      { id: 'a2', nome: 'Nubank', tipo: 'Conta corrente', saldoInicial: 0, cor: '#8B5CF6' }
    ],
    lancamentos: [
      // A despesa que se repete: dois meses atrás e um mês atrás, NUNCA
      // no mês atual — e com espaço duplo, como o banco escreve.
      { id: 'l1', tipo: 'saida', valor: 113850, descricao: 'Pix enviado para GUSTAVO  SAAR  GEMIGNANI',
        categoria: 'Outros', data: mesAtras(2), contaId: 'a1' },
      { id: 'l2', tipo: 'saida', valor: 113850, descricao: 'Pix enviado para GUSTAVO  SAAR  GEMIGNANI',
        categoria: 'Outros', data: mesAtras(1), contaId: 'a1' },
      // Uma com acento, para a busca manual
      { id: 'l3', tipo: 'saida', valor: 5000, descricao: 'MERCADO SÃO JOÃO',
        categoria: 'Alimentação', data: mesAtras(1), contaId: 'a1' },
      // E a transferência entre contas, repetida em dois meses: mesmo
      // valor, contas diferentes, datas próximas.
      { id: 'l4', tipo: 'saida', valor: 100000, descricao: 'TRANSF ENVIADA PIX',
        categoria: 'Outros', data: mesAtras(2), contaId: 'a1' },
      { id: 'l5', tipo: 'entrada', valor: 100000, descricao: 'TRANSF RECEBIDA PIX',
        categoria: 'Outros', data: mesAtras(2), contaId: 'a2' },
      { id: 'l6', tipo: 'saida', valor: 100000, descricao: 'TRANSF ENVIADA PIX',
        categoria: 'Outros', data: mesAtras(1), contaId: 'a1' },
      { id: 'l7', tipo: 'entrada', valor: 100000, descricao: 'TRANSF RECEBIDA PIX',
        categoria: 'Outros', data: mesAtras(1), contaId: 'a2' }
    ],
    clientes: [], servicos: [], pagamentos: [], parcelas: [], ativos: [], metas: []
  }
};
const caminho = path.join(dir, 't102-backup-' + process.pid + '.json');
fs.writeFileSync(caminho, JSON.stringify(backup, null, 2));

await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor');
await c.nth(1).fill('t102-' + Date.now() + '-' + process.pid + '@exemplo.com');
await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
page.on('filechooser', async fc => { await fc.setFiles(caminho); });
await page.click('#telaMais .linha:has-text("Restaurar backup")'); await page.waitForTimeout(1800);
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3500);

// --- C: a transferência não pode estar entre as despesas que se repetem ---
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1500);
const cartaoAnalise = limpo(await page.textContent('#telaMais'));
conferir('1. o comprometido conta 1 despesa, não 2: a transferência ficou de fora',
  /1 despesas que se repetem/.test(cartaoAnalise) && /1\.138,50/.test(cartaoAnalise)
  && !/2\.138,50/.test(cartaoAnalise),
  cartaoAnalise.slice(cartaoAnalise.indexOf('se repetem') - 30, cartaoAnalise.indexOf('se repetem') + 60));

// O botão fica dentro do cartão de achado, não numa .linha.
await page.click('#telaMais button:has-text("Revisar despesas"), #telaMais .linha-verTudo:has-text("Ver análise completa")');
await page.waitForTimeout(1800);
if (!/se repetem/i.test(limpo(await page.textContent('#folha').catch(() => '')))) {
  await page.click('#folha button:has-text("Revisar despesas")').catch(() => {});
  await page.waitForTimeout(1500);
}
let folha = limpo(await page.textContent('#folha').catch(() => ''));
console.log('folha:', folha.slice(0, 280));
conferir('2. a folha lista a despesa do GUSTAVO', /GUSTAVO/.test(folha), folha.slice(0, 130));
conferir('3. e não lista a transferência', !/TRANSF ENVIADA/.test(folha));

// --- A e B: "Ver lançamentos" tem de achar ---
await page.click('#folha button:has-text("Ver lançamentos")'); await page.waitForTimeout(2500);
const tela = limpo(await page.textContent('#telaTransacoes').catch(() => ''));
console.log('transacoes:', tela.slice(0, 220));
conferir('4. "Ver lançamentos" acha as duas, apesar do espaço duplo e do mês',
  /GUSTAVO/.test(tela) && !/Nada encontrado/.test(tela), tela.slice(0, 140));
await page.screenshot({ path: dir+'/m01-ver-lancamentos.png', fullPage: true });

// --- A: busca manual sem acento acha o com acento ---
await page.fill('#telaTransacoes input[type=search], #telaTransacoes input', 'sao joao');
await page.waitForTimeout(1200);
const comAcento = limpo(await page.textContent('#telaTransacoes'));
conferir('5. buscar "sao joao" acha "MERCADO SÃO JOÃO"',
  /SÃO JOÃO/.test(comAcento) && !/Nada encontrado/.test(comAcento), comAcento.slice(0, 140));

fs.unlinkSync(caminho);
await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: ver lançamentos acha, e transferência não é despesa');

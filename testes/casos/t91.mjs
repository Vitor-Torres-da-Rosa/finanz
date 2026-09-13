// Transferência entre contas: o par é achado pelo valor, com até 5 dias de
// diferença entre a saída e a entrada.
//
// O nome nunca serviu — cada banco escreve o seu —, e exigir o mesmo dia
// deixava passar o caso comum: o Pix sai dia 29 e o outro extrato lança
// dia 31.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t91'+Date.now()+'-'+process.pid+'@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.evaluate(() => new Promise((res) => {
  const h = new Date();
  const d = (dia) => h.getFullYear() + '-' + String(h.getMonth() + 1).padStart(2, '0') +
                     '-' + String(dia).padStart(2, '0');
  const dados = {
    contas: [
      { id: 'c6', nome: 'C6 Bank', tipo: 'Conta corrente', saldoInicial: 1000000 },
      { id: 'it', nome: 'Itaú', tipo: 'Conta corrente', saldoInicial: 1000000 },
      { id: 'nu', nome: 'Nubank', tipo: 'Conta corrente', saldoInicial: 1000000 }
    ],
    lancamentos: [
      // 1) o caso real: sai do C6 dia 1, o Itaú lança dia 3. Nomes diferentes.
      { id: 'p1s', tipo: 'saida', valor: 54140, data: d(1), contaId: 'c6',
        categoria: 'Outros', descricao: 'Pix Enviado Para Vitor Torres F Da Rosa' },
      { id: 'p1e', tipo: 'entrada', valor: 54140, data: d(3), contaId: 'it',
        categoria: 'Outros', descricao: 'PIX TRANSF VITOR T29/08' },
      // 2) longe demais: 6 dias não é par
      { id: 'p2s', tipo: 'saida', valor: 77700, data: d(4), contaId: 'c6',
        categoria: 'Outros', descricao: 'Saída solta' },
      { id: 'p2e', tipo: 'entrada', valor: 77700, data: d(10), contaId: 'nu',
        categoria: 'Outros', descricao: 'Entrada solta' },
      // 3) duas entradas com o mesmo valor: ganha a mais perto no tempo
      { id: 'p3s', tipo: 'saida', valor: 30000, data: d(12), contaId: 'c6',
        categoria: 'Outros', descricao: 'Pix de 300' },
      { id: 'p3longe', tipo: 'entrada', valor: 30000, data: d(15), contaId: 'nu',
        categoria: 'Outros', descricao: 'Trezentos no Nubank' },
      { id: 'p3perto', tipo: 'entrada', valor: 30000, data: d(13), contaId: 'it',
        categoria: 'Outros', descricao: 'Trezentos no Itau' },
      // 4) mesma conta não é transferência
      { id: 'p4s', tipo: 'saida', valor: 12300, data: d(5), contaId: 'c6',
        categoria: 'Outros', descricao: 'Saída no C6' },
      { id: 'p4e', tipo: 'entrada', valor: 12300, data: d(6), contaId: 'c6',
        categoria: 'Outros', descricao: 'Entrada no C6' }
    ]
  };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar');
  const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change'));
  setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await page.click('#navegacao button:has-text("Início")'); await page.waitForTimeout(1600);

const tela = async () => limpo(await page.textContent('#telaInicio'));
conferir('1. o cartão de transferências apareceu', /Transferências entre contas/.test(await tela()));
await page.click('#telaInicio .cartao:has-text("Transferências entre contas") .btn-ouro');
await page.waitForTimeout(1500);

const linhas = await page.$$eval('#folha .item-extrato', ns => ns.map(x => x.textContent.replace(/\s+/g,' ')));
console.log('pares achados:', linhas.length);
linhas.forEach(l => console.log('  *', l));
const todas = linhas.join(' || ');

conferir('2. achou exatamente 2 pares', linhas.length === 2, String(linhas.length));
conferir('3. o par de 2 dias entrou, mesmo com nomes diferentes',
  /R\$ 541,40/.test(todas) && /C6 Bank → Itaú/.test(todas));
conferir('4. e diz de quanto foi a diferença', /chegou 2 dias depois/.test(todas));
conferir('4b. mostra as duas transações, cada uma com data, conta e descrição',
  /Saiu 01\/09\/2026\s*·\s*C6 Bank/.test(todas) &&
  /Pix Enviado Para Vitor Torres F Da Rosa/.test(todas) &&
  /Entrou 03\/09\/2026\s*·\s*Itaú/.test(todas) &&
  /PIX TRANSF VITOR T29\/08/.test(todas));
conferir('5. o par de 6 dias ficou de fora', !/R\$ 777,00/.test(todas));
conferir('6. com duas candidatas, ganha a mais perto (Itaú, 1 dia)',
  /R\$ 300,00/.test(todas) && /C6 Bank → Itaú.*chegou 1 dia depois/.test(todas), todas.slice(0, 120));
conferir('7. entrada e saída na mesma conta não viram transferência', !/R\$ 123,00/.test(todas));
await page.screenshot({ path: dir+'/v01-pares.png', fullPage: true });

// --- juntar fica com a data da saída, que é quando o dinheiro saiu ---
await page.click('#folha .btn-ouro:has-text("Juntar")'); await page.waitForTimeout(900);
await page.click('#dialogoAcoes button:has-text("Confirmar")'); await page.waitForTimeout(2500);
conferir('8. o cartão sumiu depois de juntar', !/Transferências entre contas/.test(await tela()));

await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1600);
const transacoes = limpo(await page.textContent('#telaTransacoes'));
console.log('transações:', transacoes.slice(0, 300));
conferir('9. virou uma transferência só, sem receita nem despesa',
  /Transferência/.test(transacoes) && !/PIX TRANSF VITOR/.test(transacoes));
await page.screenshot({ path: dir+'/v02-depois.png', fullPage: true });

await browser.close();
if (falhas) { console.log('\n' + falhas + ' verificação(ões) falharam'); process.exit(1); }
console.log('\ntudo certo: par por valor, com janela de 5 dias');

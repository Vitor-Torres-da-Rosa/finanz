// Novidades depois de atualizar (pedidos do Vitor em 25 e 26/11/2026): o que
// mudou desde a última versão vista abre flutuando por cima do Início,
// cobrindo quase a tela toda, com cada versão pulada (da 5.107 direto para
// a atual vêm todas), e o que não cabe arrasta para ler. Até "Entendi".
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.goto(ENDERECO, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('finanz.privado', '0'); localStorage.setItem('finanz.novidades.teste', '1'); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t201-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3500);
await page.waitForTimeout(1500);
conferir('1. conta nova não recebe o histórico de novidades', await page.locator('.novidades-fundo').count() === 0);

// quem já usava, vindo da 5.103.0
await page.evaluate(() => new Promise(res => {
  const m = 'x' + Math.random().toString(36).slice(2, 7);
  const dados = { contas: [{ id: m + 'c', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 10000 }],
    lancamentos: [{ id: m + 'l', tipo: 'saida', valor: 1000, descricao: 'Mercado', categoria: 'Alimentação', data: '2026-11-20', contaId: m + 'c' }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(4000);
await page.evaluate(() => localStorage.setItem('finanz.versaoVista', '5.107.0'));
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(4000);
await page.click('#navegacao button:has-text("Início")').catch(() => {});
await page.waitForSelector('.novidades-fundo.aberta', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500);
const info = await page.evaluate(() => {
  const f = document.querySelector('.novidades-fundo.aberta');
  if (!f) return null;
  const p = f.querySelector('.novidades-painel').getBoundingClientRect();
  const rolo = f.querySelector('.novidades-rolo');
  return {
    versoes: [...f.querySelectorAll('.novidade .v')].map(v => v.textContent.trim()),
    resumo: f.querySelector('.novidades-resumo').textContent,
    cobre: (p.width * p.height) / (innerWidth * innerHeight),
    fixo: getComputedStyle(f).position,
    rola: rolo.scrollHeight > rolo.clientHeight,
    seta: !f.querySelector('.novidades-mais').classList.contains('some')
  };
});
conferir('2. vindo da 5.107.0, abre flutuando com cada versão pulada, cada uma com seu título',
  !!info && info.fixo === 'fixed' && info.versoes.length >= 3 && /^Versão 5\.108\.0/.test(info.versoes[info.versoes.length - 1]) &&
  /· atual$/.test(info.versoes[0]) && !info.versoes.some(v => /5\.107\.0/.test(v)) && /Você pulou \d+ atualizações/.test(info.resumo), JSON.stringify(info));
conferir('3. cobre quase a tela toda', !!info && info.cobre > 0.85, info && info.cobre.toFixed(2));
conferir('4. o que não cabe arrasta, e a seta avisa', !!info && info.rola && info.seta);
await page.screenshot({ path: dir + '/z201-novidades.png' });
const itens = await page.evaluate(() => [...document.querySelectorAll('.novidades-fundo .novidade li .novidade-resumo')].map(x => x.textContent));
conferir('4b. cada novidade é um resumo curto, sem "ver detalhes" para quem não é staff',
  itens.length >= 3 && itens.every(t => t.length <= 175) && await page.locator('.novidades-fundo .novidade-ver').count() === 0, itens.map(t => t.length).join(','));
await page.evaluate(() => { const r = document.querySelector('.novidades-rolo'); r.scrollTop = r.scrollHeight; r.dispatchEvent(new Event('scroll')); });
await page.waitForTimeout(400);
conferir('5. lendo até o fim, a seta some', await page.locator('.novidades-mais.some').count() === 1);
await page.click('.botao-novidades-ok'); await page.waitForTimeout(600);
conferir('6. "Entendi" fecha', await page.locator('.novidades-fundo').count() === 0);
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(4000);
conferir('7. e não volta até a próxima atualização', await page.locator('.novidades-fundo').count() === 0);

// o voltar do celular também fecha
await page.evaluate(() => localStorage.setItem('finanz.versaoVista', '5.108.0'));
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(4000);
await page.waitForSelector('.novidades-fundo.aberta', { timeout: 15000 }).catch(() => {});
const uma = await page.evaluate(() => [...document.querySelectorAll('.novidades-fundo .novidade .v')].map(v => v.textContent.trim()));
await page.goBack(); await page.waitForTimeout(700);
conferir('8. o voltar do celular fecha, e o app continua aberto', await page.locator('.novidades-fundo').count() === 0 && await page.locator('#telaInicio').count() === 1, JSON.stringify(uma));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

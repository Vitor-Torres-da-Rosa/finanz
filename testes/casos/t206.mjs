// A versão antiga do app (5.110.0) contra o servidor da migração 25: as
// tabelas antigas fechadas devolvem "proibido", e a versão antiga NÃO pode
// trocar os dados do celular pelo vazio. Ela mostra que não está
// sincronizando, e tudo continua no celular.
import { chromium, dir, ENDERECO } from '../comum.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const velho = path.join(aqui, '..', 'appteste', 'velho5110');
fs.mkdirSync(velho, { recursive: true });
for (const f of fs.readdirSync(path.join(aqui, '..', '..', 'versoes', '5.110.0'))) {
  fs.copyFileSync(path.join(aqui, '..', '..', 'versoes', '5.110.0', f), path.join(velho, f));
}
fs.copyFileSync(path.join(aqui, '..', 'config-teste.js'), path.join(velho, 'config.js'));
const ENDERECO_VELHO = ENDERECO.replace(/index\.html$/, '') + 'velho5110/index.html';

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.goto(ENDERECO_VELHO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
const versao = await page.evaluate(() => (document.body.textContent.match(/Finanz v[ersão]*\s*(\d+\.\d+\.\d+)/) || [])[1] || '');
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t206-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

// dados no celular da versão antiga
await page.evaluate(() => new Promise(res => {
  const dados = { contas: [{ id: 'cv1', nome: 'Banco Velho', tipo: 'Conta corrente', saldoInicial: 123400 }],
    lancamentos: [{ id: 'lv1', tipo: 'saida', valor: 4500, descricao: 'Padaria Velha', categoria: 'Alimentação', data: '2026-11-20', contaId: 'cv1' }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(9000);

await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(900);
const sinc = limpo(await page.textContent('#telaMais').catch(() => ''));
conferir('1. a versão antiga não consegue sincronizar e avisa', /Não está sincronizando/.test(sinc), (sinc.match(/(Não está sincronizando|Sincronizar agora).{0,80}/) || [''])[0]);

for (let i = 0; i < 2; i++) {
  await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(7000);
}
await page.click('#navegacao button:has-text("Início")').catch(() => {}); await page.waitForTimeout(800);
const inicio = limpo(await page.textContent('#telaInicio'));
conferir('2. abrindo de novo (duas vezes), os dados do celular continuam lá', /Banco Velho/.test(inicio), inicio.slice(0, 160));
await page.screenshot({ path: dir + '/z206-velho.png' });

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

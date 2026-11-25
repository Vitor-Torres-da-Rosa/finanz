// Pedido do Vitor em 25/11/2026: o backup sai cifrado com uma senha, num
// arquivo .finanz comprimido; restaurar pede a senha, e senha errada não abre.
import { chromium, dir, ENDERECO, gerarBackup, decifrarBackup } from '../comum.mjs';
import fs from 'fs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.clock.setFixedTime(new Date(2026, 10, 25, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.setItem('finanz.privado', '0'); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t195-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const lancamentos = Array.from({ length: 400 }, (_, i) => ({ id: m + 'l' + i, tipo: 'saida', valor: 1000 + i, descricao: 'Mercado Bom Preço ' + i,
    categoria: 'Alimentação', data: '2026-11-' + String(1 + (i % 25)).padStart(2, '0'), contaId: m + 'in' }));
  const dados = { contas: [{ id: m + 'in', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 100000 }], lancamentos };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3500);
await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1000);

// Senhas diferentes não passam.
await page.click('#telaMais .botao-proteja'); await page.waitForTimeout(800); await page.click('#folha .botao-backup-celular'); await page.waitForTimeout(800); await page.click('#folha .linha:has-text("Gerar backup agora")'); await page.waitForTimeout(800);
await page.fill('#folha .campo-senha-backup', 'minhasenha1'); await page.fill('#folha .campo-senha-backup2', 'outrasenha');
await page.click('#folha .btn-ouro:has-text("Gerar backup")'); await page.waitForTimeout(500);
conferir('1. as duas senhas precisam ser iguais', /As duas senhas não são iguais/.test(limpo(await page.textContent('#folha'))));
await page.screenshot({ path: dir + '/z137-backup-senha.png' });
await page.goBack(); await page.waitForTimeout(800);

const baixando = page.waitForEvent('download');
await gerarBackup(page, 'minhasenha1');
const dl = await baixando;
const caminho = dir + '/t195-' + process.pid + '.finanz'; await dl.saveAs(caminho);
const texto = fs.readFileSync(caminho, 'utf8');
const aberto = JSON.stringify({ app: 'finanz', dados: (await decifrarBackup(page, texto, 'minhasenha1')).dados });
console.log('tamanho cifrado:', texto.length, '| aberto:', aberto.length);
conferir('2. sai um .finanz cifrado, sem nenhum dado legível', /\.finanz$/.test(dl.suggestedFilename()) && JSON.parse(texto).formato === 'backup-cifrado' && !/Mercado Bom Preço|Banco Inter/.test(texto), dl.suggestedFilename());
conferir('3. e comprimido: bem menor que os dados abertos', texto.length < aberto.length / 3, texto.length + ' de ' + aberto.length);

// Restaurar: senha errada não abre; a certa abre.
await page.evaluate(() => { localStorage.setItem('x', '1'); });
page.on('filechooser', async (fc) => { await fc.setFiles(caminho); });
await page.click('#telaMais .botao-proteja'); await page.waitForTimeout(800); await page.click('#folha .botao-backup-celular'); await page.waitForTimeout(800); await page.click('#folha .linha:has-text("Restaurar de um arquivo")'); await page.waitForTimeout(1500);
await page.fill('#folha .campo-senha-restaurar', 'errada123');
await page.click('#folha .btn-ouro:has-text("Abrir backup")'); await page.waitForTimeout(2500);
conferir('4. senha errada: não abre e diz por quê', /Senha errada/.test(limpo(await page.textContent('#folha'))) && !(await page.locator('#dialogoFundo.aberta').count()));
await page.fill('#folha .campo-senha-restaurar', 'minhasenha1');
await page.click('#folha .btn-ouro:has-text("Abrir backup")'); await page.waitForTimeout(2500);
const pergunta = limpo(await page.textContent('#dialogoFundo').catch(() => ''));
conferir('5. senha certa: mostra o que tem no backup antes de restaurar', /Restaurar este backup\?/.test(pergunta) && /São 400 lançamento\(s\), 2 conta\(s\)|São 400 lançamento\(s\), 1 conta\(s\)/.test(pergunta), pergunta.slice(0, 120));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3500);
await page.click('#navegacao button:has-text("Transações")'); await page.waitForTimeout(1200);
conferir('6. restaurado, os lançamentos estão lá', /Mercado Bom Preço/.test(limpo(await page.textContent('#telaTransacoes'))));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

// Proteja seus dados (pedido do Vitor em 25/11/2026): em Mais, uma entrada
// só. Dentro: a senha dos dados, os backups ("Na nuvem" e "No celular",
// cada um com os seus guardados), as dúvidas e os textos completos.
import { chromium, dir, ENDERECO, SENHA_DO_BACKUP } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, acceptDownloads: true })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

await page.goto(ENDERECO, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); sessionStorage.setItem('finanz.privado', '0'); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t200-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3500);
// algum dado, para a cópia da nuvem ter o que guardar
await page.evaluate(() => new Promise(res => {
  const m = 'x' + Math.random().toString(36).slice(2, 7);
  const dados = { contas: [{ id: m + 'c', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 10000 }],
    lancamentos: [{ id: m + 'l', tipo: 'saida', valor: 1000, descricao: 'Mercado', categoria: 'Alimentação', data: '2026-11-20', contaId: m + 'c' }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(5000);

await page.click('#navegacao button:has-text("Mais")'); await page.waitForTimeout(1500);
const mais = limpo(await page.textContent('#telaMais'));
conferir('1. em Mais, uma entrada só: "Proteja seus dados", e os itens soltos saíram', await page.locator('#telaMais .botao-proteja').count() === 1 &&
  !/Fazer backup \(com senha\)/.test(mais) && !/Voltar a uma data/.test(mais) && !/Restaurar backup/.test(mais) &&
  !/Como seus dados são protegidos/.test(mais) && await page.locator('#telaMais .linha:has-text("Senha dos dados")').count() === 0, (mais.match(/Proteja.{0,80}/) || [''])[0]);
await page.locator('#telaMais .cartao-proteja').screenshot({ path: dir + '/z200-entrada.png' }).catch(() => {});
await page.click('#telaMais .botao-proteja'); await page.waitForTimeout(900);
await page.waitForFunction(() => !/Procurando/.test((document.querySelector('#folha .botao-backup-nuvem') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
const hub = limpo(await page.textContent('#folha'));
conferir('2. dentro: senha dos dados, backups com as senhas diferentes, dúvidas e os textos completos',
  /Senha dos dados/.test(hub) && /Na nuvem/.test(hub) && /No celular/.test(hub) && /senhas são diferentes/.test(hub) &&
  await page.locator('#folha .duvida').count() >= 7 && /Política de Privacidade/.test(hub) && /Como seus dados são protegidos/.test(hub), hub.slice(0, 200));
await page.screenshot({ path: dir + '/z200-proteja.png', fullPage: true });
await page.click('#folha .duvida:has-text("As senhas são diferentes?") .guia-cab'); await page.waitForTimeout(300);
const resp = limpo(await page.textContent('#folha .duvida.aberta'));
conferir('3. as dúvidas abrem no toque e respondem', /senha do backup abre só o arquivo \.finanz/.test(resp), resp.slice(0, 160));

// nuvem
await page.click('#folha .botao-backup-nuvem'); await page.waitForTimeout(2500);
const nuvem = limpo(await page.textContent('#folha'));
conferir('4. "Na nuvem" abre as cópias automáticas, com "Guardar uma cópia agora"', /Backup na nuvem/.test(nuvem) && /Guardar uma cópia agora/.test(nuvem), nuvem.slice(0, 160));
await page.goBack(); await page.waitForTimeout(700);

// celular
if (!(await page.locator('#folha.aberta .botao-backup-celular').count())) { await page.click('#telaMais .botao-proteja'); await page.waitForTimeout(800); }
await page.click('#folha .botao-backup-celular'); await page.waitForTimeout(800);
let cel = limpo(await page.textContent('#folha'));
conferir('5. "No celular" explica o arquivo e mostra que ainda não há nenhum', /senha que você escolhe na hora/.test(cel) && /Gerar backup agora/.test(cel) && /Restaurar de um arquivo/.test(cel) && /Nenhum ainda/.test(cel), cel.slice(0, 160));
const baixou = page.waitForEvent('download', { timeout: 20000 });
await page.click('#folha .linha:has-text("Gerar backup agora")'); await page.waitForTimeout(800);
await page.fill('#folha .campo-senha-backup', SENHA_DO_BACKUP);
await page.fill('#folha .campo-senha-backup2', SENHA_DO_BACKUP);
await page.click('#folha .btn-ouro:has-text("Gerar backup")');
await baixou; await page.waitForTimeout(1200);
await page.click('#navegacao button:has-text("Mais")').catch(() => {}); await page.waitForTimeout(800);
const entrada = limpo(await page.textContent('#telaMais .botao-proteja'));
await page.click('#telaMais .botao-proteja'); await page.waitForTimeout(800);
const sub = limpo(await page.textContent('#folha .botao-backup-celular'));
conferir('6. o botão (e a entrada em Mais) dizem quando foi o último', /1 gerado\(s\) · último hoje/.test(sub) && /1 gerado\(s\) · último hoje/.test(entrada), sub + ' | ' + entrada);
await page.click('#folha .botao-backup-celular'); await page.waitForTimeout(800);
cel = limpo(await page.textContent('#folha'));
conferir('7. e a lista mostra o backup gerado, com o nome do arquivo', /hoje às \d\d:\d\d/.test(cel) && /finanz-backup-\d+\.finanz/.test(cel), cel.slice(-160));
await page.screenshot({ path: dir + '/z200-celular.png' });

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

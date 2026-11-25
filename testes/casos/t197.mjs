// A seta da abertura (pedido do Vitor em 25/11/2026): uma seta sutil, com
// movimento, diz que tem mais embaixo. Tocar nela desce; descendo, ela some.
import { chromium, dir, ENDERECO } from '../comum.mjs';
const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2 })).newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
await page.goto(ENDERECO, { waitUntil: 'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' }); await page.waitForTimeout(1600);
const seta = page.locator('#entrada .ent-seta');
const info = await seta.evaluate(n => ({ classe: n.className, anim: getComputedStyle(n).animationName, op: getComputedStyle(n).opacity }));
conferir('1. na abertura aparece a seta, com movimento', /ent-seta/.test(info.classe) && !/sumiu/.test(info.classe) && info.anim === 'ent-seta-anda', JSON.stringify(info));
await page.screenshot({ path: dir + '/z197-seta-abertura.png' });
// Ela sobe e desce sem parar: o clique não espera ficar parada.
await seta.click({ force: true }); await page.waitForTimeout(1000);
const topo = await page.evaluate(() => document.getElementById('entrada').scrollTop);
conferir('2. tocar na seta desce a tela e a seta some', topo > 100 && /sumiu/.test(await seta.getAttribute('class')), topo);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 0; }); await page.waitForTimeout(400);
conferir('3. voltando ao topo, ela volta', !/sumiu/.test(await seta.getAttribute('class')));
// ---- os itens da abertura abrem o guia (pedido de 25/11/2026) ----
const itens = await page.$$eval('#entrada .vantagem', ns => ns.map(n => ({ tag: n.tagName, guia: n.getAttribute('data-guia'),
  mais: getComputedStyle(n.querySelector('.quadro'), '::after').content, saiba: (n.querySelector('.saiba') || {}).textContent })));
conferir('5. os 9 itens são botões, com o "+" no canto e "Saiba mais"', itens.length === 9 && itens.every(x => x.tag === 'BUTTON' && x.guia && /\+/.test(x.mais) && /Saiba mais/.test(x.saiba)),
  JSON.stringify(itens.slice(0, 2)));
await page.locator('#entrada .vantagem[data-guia="dados"]').click(); await page.waitForTimeout(1200);
const titulo = (await page.textContent('#folha')).replace(/\s+/g, ' ');
const abertas = await page.$$eval('#folha .guia-secao.aberta', ns => ns.map(n => n.getAttribute('data-assunto')));
const dados = (await page.locator('#folha .guia-secao[data-assunto="dados"]').textContent()).replace(/\s+/g, ' ');
conferir('6. "Dados protegidos" abre o guia já no assunto, com o detalhe honesto', /Como o Finanz funciona/.test(titulo) && abertas.join() === 'dados' &&
  /ponta a ponta/.test(dados) && /Ninguém mais lê/.test(dados) && /Ainda abertos/.test(dados) && /HTTPS/.test(dados), abertas.join() + ' | ' + dados.slice(0, 120));
await page.screenshot({ path: dir + '/z197-guia-dados.png' });
const nAssuntos = await page.locator('#folha .guia-secao').count();
await page.click('#folha .guia-secao[data-assunto="termos"] .guia-cab'); await page.waitForTimeout(300);
const termos = (await page.locator('#folha .guia-secao[data-assunto="termos"]').textContent()).replace(/\s+/g, ' ');
conferir('7. o guia tem todos os assuntos, e os termos de uso abrem no toque', nAssuntos === 13 && /não movimenta valores/.test(termos) &&
  await page.locator('#folha .guia-secao[data-assunto="termos"].aberta').count() === 1, nAssuntos + ' | ' + termos.slice(0, 100));
await page.click('#folha .btn-fantasma:has-text("Fechar")'); await page.waitForTimeout(800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; }); await page.waitForTimeout(300);
await page.click('#entrada .ent-guia-link'); await page.waitForTimeout(1000);
conferir('8. o link "Como o Finanz funciona" abre o guia com tudo fechado', await page.locator('#folha .guia-secao').count() === 13 &&
  await page.locator('#folha .guia-secao.aberta').count() === 0);
await page.screenshot({ path: dir + '/z197-guia-todos.png' });
await page.click('#folha .btn-fantasma:has-text("Fechar")'); await page.waitForTimeout(800);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 0; }); await page.waitForTimeout(300);
await page.screenshot({ path: dir + '/z197-abertura-itens.png' });

await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; }); await page.waitForTimeout(300);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(600);
conferir('4. no cadastro não tem seta', await page.locator('#entrada .ent-seta').count() === 0);
console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

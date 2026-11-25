// Pedido do Vitor em 25/11/2026: com 4 clientes ou mais, uma busca pelo
// nome; e do lado de "Clientes" um botão de filtros (situação, valor, data
// do registro e ordem).
import { chromium, dir, ENDERECO, irParaClientes } from '../comum.mjs';
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 });
const page = await ctx.newPage();
page.on('pageerror', e => console.log('PAGEERROR:', e.message));
let falhas = 0;
const conferir = (rotulo, ok, achado) => { if (!ok) falhas++; console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado)); };
const limpo = (t) => (t || '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();
const parcelas = () => page.$$eval('#folha .lista-parcelas .linha', ns => ns.map(n => n.textContent.replace(/ /g, ' ').replace(/\s+/g, ' ').trim()));
const abertos = [];
await page.exposeFunction('__abriu', (u) => abertos.push(u));
await page.addInitScript(() => { window.open = (u) => { window.__abriu(String(u)); return null; }; });

await page.clock.setFixedTime(new Date(2026, 10, 23, 9, 0, 0));
await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
const c = page.locator('.ent-campo input');
await c.nth(0).fill('Vitor'); await c.nth(1).fill('t187-' + Date.now() + '-' + process.pid + '@exemplo.com'); await c.nth(3).fill('senha123');
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(3000);

await page.evaluate(() => new Promise(res => {
  const m = Math.random().toString(36).slice(2, 8);
  const C = (k, nome, fone) => ({ id: m + k, nome, telefones: fone ? [{ numero: fone, whats: true }] : [] });
  const S = (k, cli, valor, data) => ({ id: m + 's' + k, clienteId: m + cli, nome: 'Serviço ' + k, tipo: 'Serviço', valor, data, obs: '' });
  const dados = {
    contas: [{ id: m + 'cc', nome: 'Banco Inter', tipo: 'Conta corrente', saldoInicial: 0 }],
    clientes: [C('a', 'Vó Maria', '51988887777'), C('b', 'Caçapava vizinho', '51977776666'), C('c', 'Edison e Sandra', '51966665555'),
               C('d', 'Gustavo Appelt', '47955554444'), C('e', 'Henrique Klein', ''), C('f', 'Ana Quitada', '')],
    servicos: [S(1, 'a', 120000, '2026-06-01'), S(2, 'b', 18000, '2026-09-15'), S(3, 'c', 3551500, '2026-11-20'),
               S(4, 'd', 1376800, '2026-10-01'), S(5, 'e', 420000, '2026-03-10'), S(6, 'f', 50000, '2026-11-01')],
    parcelas: [{ id: m + 'pa', clienteId: m + 'a', servicoId: m + 's1', numero: 1, total: 1, valor: 120000, vencimento: '2026-10-01', minimo: 0, jurosAtraso: 0, quitadaEm: '', pagamentoId: '', criadoEm: 1 }],
    pagamentos: [{ id: m + 'g6', clienteId: m + 'f', servicoId: m + 's6', valor: 50000, data: '2026-11-02', parcelaId: '' }] };
  const f = new File([JSON.stringify({ app: 'finanz', dados })], 'b.json', { type: 'application/json' });
  const inp = document.getElementById('arquivoRestaurar'); const dt = new DataTransfer(); dt.items.add(f); inp.files = dt.files;
  inp.dispatchEvent(new Event('change')); setTimeout(() => res(true), 900);
}));
await page.click('#dialogoAcoes button:has-text("Restaurar")'); await page.waitForTimeout(3000);
await irParaClientes(page);
const card = page.locator('#telaInicio .cartao', { has: page.locator('.cartao-titulo', { hasText: /^Clientes$/ }) });
const nomes = async () => card.locator('.lista-clientes .linha .linha-titulo').allTextContents();
const chip = (grupo, rotulo) => page.click('#folha .campo:has-text("' + grupo + '") .chip:has-text("' + rotulo + '")');
const aplicar = () => page.click('#folha .acoes .btn-ouro');

conferir('1. com 6 clientes, aparece a busca', (await card.locator('.busca-clientes input').count()) === 1);
const lado = await card.locator('.cartao-topo-fim').evaluate(n => [...n.children].map(x => (x.classList.contains('botao-filtro') ? 'filtro' : x.textContent.trim())).join('|')).catch(() => '');
conferir('2. o botão de filtros fica do lado do "+ Novo"', lado === 'filtro|+ Novo', lado);
await card.screenshot({ path: dir + '/z123-clientes-busca.png' });

await card.locator('.busca-clientes input').fill('gust'); await page.waitForTimeout(300);
conferir('3. buscando "gust", só o Gustavo', (await nomes()).join('|') === 'Gustavo Appelt', (await nomes()).join('|'));
await card.locator('.busca-clientes input').fill('caçapava'); await page.waitForTimeout(300);
conferir('4. sem ligar para acento e maiúscula', (await nomes()).join('|') === 'Caçapava vizinho', (await nomes()).join('|'));
await card.locator('.busca-clientes input').fill('9555'); await page.waitForTimeout(300);
conferir('5. pelo telefone também', (await nomes()).join('|') === 'Gustavo Appelt', (await nomes()).join('|'));
const focada = await page.evaluate(() => document.activeElement && document.activeElement.id === 'buscaClientes');
conferir('6. digitando, o campo continua com o foco (teclado aberto)', focada);
await card.locator('.busca-clientes input').fill('zzz'); await page.waitForTimeout(300);
conferir('7. sem nada, diz que não achou', /Ninguém com "zzz"/.test(limpo(await card.textContent())));
await card.locator('.busca-clientes input').fill(''); await page.waitForTimeout(300);
conferir('8. limpando a busca, todos de volta', (await nomes()).length === 6, (await nomes()).length);

await card.locator('.botao-filtro').click(); await page.waitForTimeout(900);
const fol = limpo(await page.textContent('#folha'));
conferir('9. a folha de filtros tem situação, valor, data e ordem', /Situação/.test(fol) && /Valor a receber/.test(fol) && /Último registro/.test(fol) && /Ordenar por/.test(fol), fol.slice(0, 120));
await chip('Situação', 'Em aberto'); await chip('Valor a receber', 'Acima de R$ 5 mil'); await chip('Ordenar por', 'Nome');
await page.waitForTimeout(300);
const botaoAplicar = limpo(await page.textContent('#folha .acoes .btn-ouro'));
conferir('10. o botão já diz quantos vão aparecer', botaoAplicar === 'Mostrar 2 cliente(s)', botaoAplicar);
await page.screenshot({ path: dir + '/z124-filtros-clientes.png' });
await aplicar(); await page.waitForTimeout(1200);
conferir('11. em aberto e acima de R$ 5 mil, por nome: Edison e Gustavo', (await nomes()).join('|') === 'Edison e Sandra|Gustavo Appelt', (await nomes()).join('|'));
const nota = limpo(await card.locator('.nota-filtro-clientes').textContent().catch(() => ''));
conferir('12. diz quantos e quanto, e o botão marca os filtros ligados', /2 de 6 cliente\(s\) · R\$ 49\.283,00 a receber/.test(nota) && (await card.locator('.botao-filtro.ligado .selo-num').count()) === 1, nota);
await card.screenshot({ path: dir + '/z125-clientes-filtrados.png' });

await card.locator('.limpar-filtro').click(); await page.waitForTimeout(1200);
conferir('13. "Limpar" volta todos', (await nomes()).length === 6 && !(await card.locator('.botao-filtro.ligado').count()));
await card.locator('.botao-filtro').click(); await page.waitForTimeout(900);
await chip('Último registro', 'Últimos 30 dias'); await chip('Ordenar por', 'Registro mais recente');
await aplicar(); await page.waitForTimeout(1200);
conferir('14. registro nos últimos 30 dias, mais recente primeiro', (await nomes()).join('|') === 'Edison e Sandra|Ana Quitada', (await nomes()).join('|'));
await card.locator('.botao-filtro').click(); await page.waitForTimeout(900);
await page.click('#folha .btn-fantasma:has-text("Limpar filtros")'); await page.waitForTimeout(1200);
await card.locator('.botao-filtro').click(); await page.waitForTimeout(900);
await chip('Situação', 'Atrasados'); await aplicar(); await page.waitForTimeout(1200);
conferir('15. só atrasados: a Vó Maria', (await nomes()).join('|') === 'Vó Maria', (await nomes()).join('|'));

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

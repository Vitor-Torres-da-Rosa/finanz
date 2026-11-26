// Staff (pedido do Vitor em 26/11/2026): só a conta staff vê a linha em
// Mais e os números. Ativo = abriu o app nos últimos 7 dias. O servidor
// recusa os números para qualquer outra conta, mesmo pedindo direto.
import { chromium, dir, ENDERECO } from '../comum.mjs';
import { createHash } from 'node:crypto';
import pg from 'pg';
const db = new pg.Client({ host: '/tmp', port: 55433, user: 'postgres', database: 'caixa_app' });
await db.connect();
const browser = await chromium.launch();

let falhas = 0;
const conferir = (rotulo, ok, achado) => {
  if (!ok) falhas++;
  console.log((ok ? 'ok   ' : 'FALHA') + ' · ' + rotulo + (achado === undefined ? '' : ' · ' + achado));
};
const limpo = (t) => (t || '').replace(/\s+/g, ' ').trim();

const criarConta = async (email) => {
  const page = await (await browser.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
  page.on('pageerror', e => console.log('PAGEERROR:', e.message));
  await page.goto(ENDERECO, { waitUntil:'networkidle' }); await page.waitForTimeout(400);
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.reload({ waitUntil:'networkidle' }); await page.waitForTimeout(1600);
  await page.evaluate(() => { document.getElementById('entrada').scrollTop = 99999; });
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(500);
  const c = page.locator('.ent-campo input');
  await c.nth(0).fill('Pessoa'); await c.nth(1).fill(email); await c.nth(3).fill('senha123');
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
  await page.click('.btn-dourado:has-text("Continuar")'); await page.waitForTimeout(400);
  await page.click('.btn-dourado:has-text("Criar minha conta")'); await page.waitForTimeout(4000);
  return page;
};
const rpc = (page, nome) => page.evaluate(async (nome) => {
  const tok = JSON.parse(localStorage.getItem('caixa.nuvem.v4')).access_token;
  const cfg = window.FINANZ_CONFIG;
  const r = await fetch(cfg.supabaseUrl + '/rest/v1/rpc/' + nome, { method: 'POST', body: '{}',
    headers: { apikey: cfg.supabaseAnonKey, Authorization: 'Bearer ' + tok, 'Content-Type': 'application/json' } });
  return { status: r.status, corpo: await r.text() };
}, nome);

const sufixo = Date.now() + '-' + process.pid;
const emailComum = 't204-comum-' + sufixo + '@exemplo.com';
const emailStaff = 't204-staff-' + sufixo + '@exemplo.com';
const hash = createHash('sha256').update(emailStaff).digest('hex');
await db.query('insert into public.staff (email_hash) values ($1) on conflict do nothing', [hash]);

try {
  // ---- conta comum ----
  const comum = await criarConta(emailComum);
  await comum.click('#navegacao button:has-text("Mais")'); await comum.waitForTimeout(900);
  conferir('1. conta comum: Mais não mostra o Staff', await comum.locator('#telaMais .botao-staff').count() === 0);
  const recusa = await rpc(comum, 'staff_resumo');
  conferir('2. conta comum pedindo os números direto: o servidor recusa', recusa.status !== 200 && !/cadastrados/.test(recusa.corpo), recusa.status + ' ' + recusa.corpo.slice(0, 80));
  const idComum = (await db.query('select id from auth.users where email = $1', [emailComum])).rows[0].id;
  const visto = (await db.query('select visto_em from public.atividade where user_id = $1', [idComum])).rows[0];
  conferir('3. abrir o app anota a hora da última abertura', !!visto && Date.now() - new Date(visto.visto_em).getTime() < 5 * 60 * 1000, visto && visto.visto_em);
  const colunas = (await db.query("select column_name from information_schema.columns where table_schema='public' and table_name='atividade' order by 1")).rows.map(r => r.column_name);
  conferir('4. a anotação é só a hora (sem histórico)', colunas.join(',') === 'user_id,visto_em', colunas.join(','));

  // ---- conta staff ----
  const staff = await criarConta(emailStaff);
  await staff.click('#navegacao button:has-text("Mais")'); await staff.waitForTimeout(900);
  await staff.waitForSelector('#telaMais .botao-staff', { timeout: 15000 }).catch(() => {});
  conferir('5. conta staff: a linha Staff aparece em Mais', await staff.locator('#telaMais .botao-staff').count() === 1);
  await staff.screenshot({ path: dir + '/z204-mais.png' });
  const total = Number((await db.query('select count(*) from auth.users where deleted_at is null')).rows[0].count);
  // uma conta que não abre há 10 dias não conta como ativa
  await db.query("update public.atividade set visto_em = now() - interval '10 days' where user_id = $1", [idComum]);
  const ativos = Number((await db.query("select count(*) from auth.users u left join public.atividade a on a.user_id = u.id where u.deleted_at is null and greatest(a.visto_em, u.last_sign_in_at) >= now() - interval '7 days'")).rows[0].count);
  await staff.click('#telaMais .botao-staff');
  await staff.waitForFunction(() => /Cadastrados/.test((document.querySelector('#folha .staff-corpo') || {}).textContent || ''), null, { timeout: 15000 }).catch(() => {});
  const tiles = await staff.evaluate(() => Object.fromEntries([...document.querySelectorAll('#folha .tile')].map(t =>
    [t.querySelector('.tile-rotulo').textContent.trim(), t.querySelector('.tile-valor').textContent.trim()])));
  conferir('6. o Staff mostra cadastrados e ativos (7 dias) iguais ao banco',
    tiles['Cadastrados'] === String(total) && tiles['Ativos (7 dias)'] === String(ativos), JSON.stringify(tiles));
  conferir('7. quem não abriu há mais de 7 dias não conta como ativo', ativos < total, ativos + ' de ' + total);
  conferir('8. o "i" do Staff explica o que é ativo', await staff.locator('#folha [data-dica="staff.usuarios"]').count() === 1);
  await staff.screenshot({ path: dir + '/z204-staff.png' });
} finally {
  await db.query('delete from public.staff where email_hash = $1', [hash]);
  await db.end();
}

console.log(falhas ? falhas + ' falha(s)' : 'tudo certo');
await browser.close();
process.exit(falhas ? 1 : 0);

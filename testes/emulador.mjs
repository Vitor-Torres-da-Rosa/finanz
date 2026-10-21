// Emulador mínimo do Supabase: fala GoTrue (/auth/v1) e PostgREST (/rest/v1)
// em cima do Postgres local, que roda o schema.sql de verdade, com as
// políticas RLS de verdade. Serve para exercitar o cliente do app.

import http from 'node:http';
import crypto from 'node:crypto';
import pg from 'pg';

const { Pool, types } = pg;
// Igual ao PostgREST de verdade: date vira texto e bigint vira número.
types.setTypeParser(1082, (v) => v);
types.setTypeParser(20, (v) => Number(v));
const pool = new Pool({ host: '/tmp', port: 55433, user: 'postgres', database: 'caixa_app', max: 30 });

const usuarios = new Map();   // email -> { id, senha, nome }
const tokens = new Map();     // access_token -> uid
const refresh = new Map();    // refresh_token -> uid

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', '*');
}

function json(res, status, corpo) {
  if (status >= 400) console.log('!! ' + status + ' ' + (res.req ? res.req.method + ' ' + res.req.url : '') + ' -> ' + JSON.stringify(corpo));
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(corpo === undefined ? '' : JSON.stringify(corpo));
}

function sessaoDe(uid, email, nome) {
  const a = crypto.randomBytes(16).toString('hex');
  const r = crypto.randomBytes(16).toString('hex');
  tokens.set(a, uid);
  refresh.set(r, uid);
  return {
    access_token: a, refresh_token: r, expires_in: 3600, token_type: 'bearer',
    user: { id: uid, email, user_metadata: { full_name: nome } }
  };
}

function uidDoPedido(req) {
  const auth = req.headers['authorization'] || '';
  const t = auth.replace(/^Bearer\s+/i, '');
  return tokens.get(t) || null;
}

// Traduz os filtros do PostgREST que o app usa.
function condicoes(params) {
  const onde = [];
  const valores = [];
  for (const [chave, valor] of params) {
    if (chave === 'select' || chave === 'on_conflict' || chave === 'order') continue;
    const m = /^(\w+)\.(.*)$/.exec(valor);
    if (!m) continue;
    const [, op, alvo] = m;
    const COMPARA = { eq: '=', neq: '<>', lt: '<', lte: '<=', gt: '>', gte: '>=' };
    if (COMPARA[op]) { valores.push(alvo); onde.push(`"${chave}" ${COMPARA[op]} $${valores.length}`); }
    else if (op === 'is') { onde.push(`"${chave}" IS ${alvo.toUpperCase() === 'NULL' ? 'NULL' : 'NOT NULL'}`); }
  }
  return { onde: onde.length ? 'WHERE ' + onde.join(' AND ') : '', valores };
}

async function comoUsuario(uid, executar) {
  const cliente = await pool.connect();
  try {
    await cliente.query('BEGIN');
    await cliente.query('SET LOCAL ROLE authenticated');
    await cliente.query(`SET LOCAL request.jwt.claim.sub = '${uid}'`);
    const r = await executar(cliente);
    await cliente.query('COMMIT');
    return r;
  } catch (e) {
    await cliente.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    cliente.release();
  }
}

const servidor = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://local');
  let corpoBruto = '';
  for await (const pedaco of req) corpoBruto += pedaco;
  let corpo = null;
  if (corpoBruto) { try { corpo = JSON.parse(corpoBruto); } catch { corpo = null; } }

  try {
    // ---------- Autenticação ----------
    if (url.pathname === '/auth/v1/signup') {
      const email = String(corpo.email || '').toLowerCase();
      if (usuarios.has(email)) return json(res, 422, { msg: 'User already registered' });
      const id = crypto.randomUUID();
      const nome = (corpo.data && corpo.data.full_name) || '';
      const confirmar = process.env.CONFIRMAR_EMAIL === '1';
      usuarios.set(email, { id, senha: corpo.password, nome, confirmado: !confirmar });
      console.log('signup redirect_to =', url.searchParams.get('redirect_to'));
      await pool.query(
        'insert into auth.users (id, email, raw_user_meta_data) values ($1,$2,$3)',
        [id, email, JSON.stringify({ full_name: nome })]);
      if (confirmar) return json(res, 200, { user: { id, email }, session: null });
      return json(res, 200, sessaoDe(id, email, nome));
    }

    if (url.pathname === '/auth/v1/resend') {
      console.log('resend redirect_to =', url.searchParams.get('redirect_to'));
      const u = usuarios.get(String(corpo.email || '').toLowerCase());
      if (u) u.confirmado = true;
      return json(res, 200, {});
    }

    if (url.pathname === '/auth/v1/token') {
      const tipo = url.searchParams.get('grant_type');
      if (tipo === 'password') {
        const email = String(corpo.email || '').toLowerCase();
        const u = usuarios.get(email);
        if (!u || u.senha !== corpo.password) {
          return json(res, 400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
        }
        if (!u.confirmado) {
          return json(res, 400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
        }
        return json(res, 200, sessaoDe(u.id, email, u.nome));
      }
      if (tipo === 'refresh_token') {
        const uid = refresh.get(corpo.refresh_token);
        if (!uid) return json(res, 400, { error_description: 'Invalid Refresh Token' });
        const email = [...usuarios.entries()].find(([, v]) => v.id === uid)?.[0] || '';
        const u = usuarios.get(email);
        return json(res, 200, sessaoDe(uid, email, u ? u.nome : ''));
      }
      return json(res, 400, { error_description: 'grant_type não suportado' });
    }

    if (url.pathname === '/auth/v1/user') {
      const uid = uidDoPedido(req);
      if (!uid) return json(res, 401, { msg: 'invalid token' });
      const par = [...usuarios.entries()].find(([, v]) => v.id === uid);
      return json(res, 200, {
        id: uid, email: par ? par[0] : '',
        user_metadata: { full_name: par ? par[1].nome : '' }
      });
    }

    // GOOGLE_LIGADO=1 liga o provedor, para testar os dois cenários.
    if (url.pathname === '/auth/v1/settings') {
      return json(res, 200, {
        external: {
          google: process.env.GOOGLE_LIGADO === '1',
          apple: false,
          facebook: false
        }
      });
    }

    if (url.pathname === '/auth/v1/logout') { cors(res); res.writeHead(204); res.end(); return; }
    if (url.pathname === '/auth/v1/recover') return json(res, 200, {});

    // ---------- Dados ----------
    if (url.pathname.startsWith('/rest/v1/')) {
      const tabela = url.pathname.slice('/rest/v1/'.length);
      if (!/^[a-z_]+$/.test(tabela)) return json(res, 400, { message: 'tabela inválida' });
      const uid = uidDoPedido(req);
      if (!uid) return json(res, 401, { message: 'sem token' });

      const { onde, valores } = condicoes(url.searchParams);

      if (req.method === 'GET') {
        const linhas = await comoUsuario(uid, (c) =>
          c.query(`select * from public."${tabela}" ${onde}`, valores));
        return json(res, 200, linhas.rows);
      }

      if (req.method === 'POST') {
        const registros = Array.isArray(corpo) ? corpo : [corpo];
        if (!registros.length) return json(res, 201, []);
        const conflito = (url.searchParams.get('on_conflict') || 'id').split(',');
        const colunas = Object.keys(registros[0]);
        await comoUsuario(uid, async (c) => {
          for (const reg of registros) {
            const cols = colunas.map((k) => `"${k}"`).join(', ');
            const marc = colunas.map((_, i) => `$${i + 1}`).join(', ');
            const set = colunas.filter((k) => !conflito.includes(k))
              .map((k) => `"${k}" = excluded."${k}"`).join(', ');
            const alvo = conflito.map((k) => `"${k}"`).join(', ');
            const sql = `insert into public."${tabela}" (${cols}) values (${marc})` +
              (set ? ` on conflict (${alvo}) do update set ${set}` : ` on conflict (${alvo}) do nothing`);
            // Colunas jsonb querem o JSON como texto; text[] vai como array mesmo.
            const JSONB = ['telefones', 'regras_categoria', 'pares_ignorados', 'importacoes', 'propostas', 'taxas', 'revisados'];
            await c.query(sql, colunas.map((k) => {
              const v = reg[k];
              return (JSONB.includes(k) && v && typeof v === 'object') ? JSON.stringify(v) : v;
            }));
          }
        });
        cors(res); res.writeHead(201); res.end(); return;
      }

      if (req.method === 'PATCH') {
        if (!onde) return json(res, 400, { message: 'PATCH sem filtro' });
        const colunas = Object.keys(corpo);
        const set = colunas.map((k, i) => `"${k}" = $${i + 1}`).join(', ');
        const desloc = colunas.length;
        const ondeDesl = onde.replace(/\$(\d+)/g, (_, n) => '$' + (Number(n) + desloc));
        await comoUsuario(uid, (c) =>
          c.query(`update public."${tabela}" set ${set} ${ondeDesl}`,
            colunas.map((k) => corpo[k]).concat(valores)));
        cors(res); res.writeHead(204); res.end(); return;
      }

      if (req.method === 'DELETE') {
        // Mesma trava do PostgREST de verdade: apagar sem filtro é recusado.
        // Ela existe aqui porque o emulador já ignorou um filtro que não
        // sabia traduzir (`lt.`) e transformou "apague o que passou de 14
        // dias" em "apague tudo" — sem reclamar de nada.
        if (!onde) return json(res, 400, { message: 'DELETE sem filtro' });
        await comoUsuario(uid, (c) =>
          c.query(`delete from public."${tabela}" ${onde}`, valores));
        cors(res); res.writeHead(204); res.end(); return;
      }
    }

    return json(res, 404, { message: 'não encontrado' });
  } catch (e) {
    return json(res, 400, { message: e.message });
  }
});

servidor.listen(54321, () => console.log('emulador ouvindo em 54321'));

// Roda os testes do Finanz em paralelo.
//
//   node testes/rodar.mjs                  -> todos, 8 de cada vez
//   node testes/rodar.mjs 4                -> todos, 4 de cada vez
//   node testes/rodar.mjs 12 t72 t80 t81   -> só esses
//
// Cada teste abre o seu próprio navegador e cria a sua própria conta, então
// eles não se atrapalham. 12 ao mesmo tempo foi o padrão por muito tempo:
// rendia uns 255s na suíte inteira. Só que com 66 testes a máquina satura,
// e os testes que esperam por tempo fixo depois de salvar começaram a cair
// um por rodada — t57, t86, t88, t80, cada vez um diferente, todos verdes
// sozinhos. Suíte que acusa um inocente por rodada não serve para nada.
//
// 8 ao mesmo tempo: 305s e 66/66. Cinquenta segundos a mais por um
// resultado em que dá para acreditar. O corte de 300s por teste continua
// pegando travada de verdade.
import { spawn, execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const casos = path.join(raiz, 'casos');

const args = process.argv.slice(2);
const quantos = /^\d+$/.test(args[0]) ? +args.shift() : 8;
const TODOS = fs.readdirSync(casos).filter((f) => /^t\d+b?\.mjs$/.test(f))
  .sort((a, b) => {
    const na = +a.match(/^t(\d+)/)[1], nb = +b.match(/^t(\d+)/)[1];
    return na - nb || a.localeCompare(b);
  });
const lista = args.length ? args.map((a) => (a.endsWith('.mjs') ? a : a + '.mjs')) : TODOS;

const faltando = lista.filter((f) => !fs.existsSync(path.join(casos, f)));
if (faltando.length) { console.error('não achei:', faltando.join(' ')); process.exit(2); }

// Banco caído dá 40 falhas que não são do app. Melhor conferir antes.
try {
  console.log(execSync(path.join(raiz, 'subir.sh'), { encoding: 'utf8' }).trim());
} catch (e) {
  console.error('a base de teste não subiu:', String(e.stdout || e.message).trim());
  console.error('rode testes/preparar.sh primeiro.');
  process.exit(3);
}

const inicio = Date.now();
const resultados = [];
let proximo = 0, rodando = 0;

function tocar() {
  while (rodando < quantos && proximo < lista.length) {
    const nome = lista[proximo++];
    rodando++;
    const t0 = Date.now();
    const p = spawn('node', [path.join(casos, nome)], { cwd: raiz, stdio: ['ignore', 'pipe', 'pipe'] });
    let saida = '';
    p.stdout.on('data', (d) => { saida += d; });
    p.stderr.on('data', (d) => { saida += d; });
    const corta = setTimeout(() => p.kill('SIGKILL'), 300000);
    p.on('close', (codigo) => {
      clearTimeout(corta);
      rodando--;
      resultados.push({ nome, ok: codigo === 0, seg: ((Date.now() - t0) / 1000).toFixed(0), saida });
      process.stdout.write(codigo === 0 ? '.' : 'X');
      if (resultados.length === lista.length) fim(); else tocar();
    });
  }
}

function fim() {
  const total = ((Date.now() - inicio) / 1000).toFixed(0);
  const ruins = resultados.filter((r) => !r.ok);
  console.log('\n');
  ruins.forEach((r) => {
    console.log('=== FALHOU ' + r.nome + ' (' + r.seg + 's) ===');
    console.log(r.saida.split('\n').slice(-25).join('\n'));
  });
  const lentos = resultados.slice().sort((a, b) => b.seg - a.seg).slice(0, 5);
  console.log('mais demorados: ' + lentos.map((r) => r.nome.replace('.mjs', '') + ' ' + r.seg + 's').join(', '));
  console.log((resultados.length - ruins.length) + '/' + resultados.length + ' passaram em ' + total + 's' +
    (ruins.length ? ' | falharam: ' + ruins.map((r) => r.nome.replace('.mjs', '')).join(' ') : ''));
  process.exit(ruins.length ? 1 : 0);
}

console.log('rodando ' + lista.length + ' testes, ' + quantos + ' de cada vez');
tocar();

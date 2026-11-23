// Tira o print do antes e do depois de uma proposta, no mesmo cenário.
//
//   node propostas/print.mjs 0001
//
// O "antes" é o app do ramo de trabalho; o "depois" é o app do ramo da
// proposta. Os dois passam pelo mesmo roteiro, na mesma tela de celular,
// para a comparação ser honesta: se a diferença aparece, é da mudança.
import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const numero = process.argv[2];
if (!/^\d{4}$/.test(numero || '')) {
  console.error('uso: node propostas/print.mjs 0001');
  process.exit(2);
}

const pasta = fs.readdirSync(path.join(raiz, 'propostas'))
  .find((n) => n.startsWith(numero + '-'));
if (!pasta) { console.error('não achei a pasta da proposta ' + numero); process.exit(2); }

const cenario = path.join(raiz, 'propostas', 'cenarios', numero + '.mjs');
if (!fs.existsSync(cenario)) { console.error('não achei o cenário ' + cenario); process.exit(2); }

const ramoAtual = execSync('git rev-parse --abbrev-ref HEAD', { cwd: raiz, encoding: 'utf8' }).trim();
const base = execSync('git rev-parse --abbrev-ref --symbolic-full-name @{u} || echo origin/main',
  { cwd: raiz, encoding: 'utf8', shell: '/bin/bash' }).trim();

function copiarApp(deOnde) {
  // deOnde: '' usa o que está na pasta; um ramo usa o conteúdo dele.
  for (const arq of ['index.html', 'sw.js', 'manifest.webmanifest']) {
    const destino = path.join(raiz, 'testes', 'appteste', arq);
    if (!deOnde) { fs.copyFileSync(path.join(raiz, arq), destino); continue; }
    fs.writeFileSync(destino, execSync('git show ' + deOnde + ':' + arq, { cwd: raiz, maxBuffer: 64 * 1024 * 1024 }));
  }
}

function tirar(saida) {
  const r = spawnSync('node', [path.join(raiz, 'propostas', 'rodar-cenario.mjs'), cenario, saida],
    { cwd: path.join(raiz, 'testes'), stdio: 'inherit' });
  if (r.status !== 0) { console.error('o cenário falhou'); process.exit(1); }
}

execSync(path.join(raiz, 'testes', 'subir.sh'), { cwd: raiz, stdio: 'inherit' });

// O antes vem do ramo de onde a proposta saiu.
const origem = process.env.RAMO_BASE || 'claude/receitas-despesas-app-q8nvq0';
console.log('antes: ' + origem + ' | depois: ' + ramoAtual);
copiarApp(origem);
tirar(path.join(raiz, 'propostas', pasta, 'antes.png'));
copiarApp('');
tirar(path.join(raiz, 'propostas', pasta, 'depois.png'));
console.log('prontos em propostas/' + pasta + '/');

const VERSAO = '5.25.0';
const CACHE = 'finanz-v' + VERSAO;
const CACHE_PARTILHA = 'finanz-partilha';

const ESSENCIAIS = [
  './',
  './index.html',
  './config.js',
  './fundo.webp',
  './abertura.webp',
  './selo.webp',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable.png'
];

self.addEventListener('install', (evento) => {
  evento.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ESSENCIAIS))
      .catch(() => undefined)
  );
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(
        // Saem SÓ as caixas de arquivos de versões anteriores do Finanz
        // (finanz-v5.16.0 e companhia). Elas guardam html, js e imagens —
        // nunca dado seu. Os seus dados moram no armazenamento do site,
        // que atualização nenhuma encosta: é por isso que atualizar nunca
        // apagou nada, e o teste t114 confere isso a cada rodada.
        //
        // Antes esta linha apagava tudo o que não fosse a caixa desta
        // versão. Era largo demais: qualquer caixa que o app passasse a
        // usar para guardar algo da pessoa sumiria numa atualização sem
        // ninguém notar — o cache da partilha, que segura o extrato
        // recém-compartilhado, já precisava de uma exceção escrita à mão.
        // Agora a regra é ao contrário: só apago o que eu sei que é
        // descartável.
        //
        // As caixas das versões velhas saem mesmo, e de propósito: são uns
        // megabytes de arquivos mortos por versão, e armazenamento cheio é
        // o que faz o navegador começar a jogar coisa fora por conta
        // própria — inclusive o que interessa.
        chaves.filter((chave) => /^finanz-v/.test(chave) && chave !== CACHE)
          .map((chave) => caches.delete(chave))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (evento) => {
  const dados = evento.data || {};
  if (dados.tipo === 'PULAR_ESPERA') self.skipWaiting();
  if (dados.tipo === 'VERSAO' && evento.source) {
    evento.source.postMessage({ tipo: 'VERSAO', versao: VERSAO });
  }
});

// Onde o arquivo compartilhado fica guardado até o aplicativo pegar ele.
const CAMINHO_PARTILHA = './arquivo-compartilhado';

self.addEventListener('fetch', (evento) => {
  const req = evento.request;
  const alvo = new URL(req.url);

  // O Android manda o arquivo aqui quando a pessoa usa "Compartilhar".
  // Guardo no cache e mando o aplicativo abrir; é o caminho que funciona
  // quando o seletor de arquivos não deixa ler.
  if (req.method === 'POST' && alvo.pathname.endsWith('/compartilhar')) {
    evento.respondWith((async () => {
      try {
        const dados = await req.formData();
        const arquivo = dados.get('arquivo');
        if (arquivo && arquivo.size) {
          const cache = await caches.open(CACHE_PARTILHA);
          await cache.put(CAMINHO_PARTILHA, new Response(arquivo, {
            headers: {
              'Content-Type': arquivo.type || 'application/octet-stream',
              'X-Nome': encodeURIComponent(arquivo.name || 'arquivo')
            }
          }));
          return Response.redirect('./?compartilhado=1', 303);
        }
      } catch (e) { /* cai no redirecionamento simples */ }
      return Response.redirect('./?compartilhado=0', 303);
    })());
    return;
  }

  if (req.method !== 'GET') return;

  // Rede primeiro, com reserva no cache.
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  evento.respondWith(
    fetch(req)
      .then((resposta) => {
        if (resposta && resposta.ok && resposta.type === 'basic') {
          const copia = resposta.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copia)).catch(() => undefined);
        }
        return resposta;
      })
      .catch(() => caches.match(req).then((emCache) => {
        if (emCache) return emCache;
        if (req.mode === 'navigate') return caches.match('./index.html');
        return Response.error();
      }))
  );
});

const VERSAO = '5.6.1';
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
        // O cache da partilha guarda o arquivo que a pessoa acabou de
        // compartilhar: apagar ele numa atualização perderia o arquivo.
        chaves.filter((chave) => chave !== CACHE && chave !== CACHE_PARTILHA)
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

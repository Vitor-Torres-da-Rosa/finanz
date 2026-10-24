const http=require('http'),fs=require('fs'),p=require('path');
const raiz=process.argv[2], porta=Number(process.argv[3]);
const tipos={'.html':'text/html','.js':'text/javascript','.webp':'image/webp','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.jpg':'image/jpeg','.png':'image/png'};

// O teste da troca de versão precisa de um sw.js com outra versão, e só
// para a aba dele — os outros testes rodam ao mesmo tempo e um arquivo
// trocado no disco faria todos verem atualização. O navegador não deixa
// interceptar o pedido do próprio service worker (nem o Playwright pega),
// mas esse pedido é da mesma origem e leva os cookies. Então: cookie
// swversao=99.0.0-teste e este servidor troca a linha da versão só para
// quem tem o cookie.
function versaoPedida(q){
  const m=/(?:^|;\s*)swversao=([\w.\-]{1,40})(?:;|$)/.exec(q.headers.cookie||'');
  return m?m[1]:'';
}

http.createServer((q,s)=>{let u=q.url.split('?')[0]; if(u==='/')u='/index.html';
const f=p.join(raiz,u);
try{let b=fs.readFileSync(f);
const v=u==='/sw.js'?versaoPedida(q):'';
if(v)b=Buffer.from(String(b).replace(/^const VERSAO = '[^']*';/m,"const VERSAO = '"+v+"';"),'utf8');
s.writeHead(200,{'Content-Type':tipos[p.extname(f)]||'application/octet-stream'});s.end(b);}catch(e){s.writeHead(404);s.end('x');}}).listen(porta);

#!/bin/bash
# Guarda uma cópia inteira e funcionando da versão atual em versoes/<n>/.
#
# Serve para uma coisa só: se uma atualização estragar alguma coisa, dá para
# abrir a versão anterior no celular na hora, sem mexer em git nem esperar
# ninguém. Guardo as cinco últimas; mais que isso só engorda o repositório.
set -u
cd "$(dirname "$0")" || exit 1

VERSAO=$(grep -oE "var VERSAO = '[^']+'" index.html | head -1 | cut -d"'" -f2)
[ -n "$VERSAO" ] || { echo "não achei a versão no index.html"; exit 1; }

DESTINO="versoes/$VERSAO"
if [ -d "$DESTINO" ]; then echo "a versão $VERSAO já está guardada"; exit 0; fi

mkdir -p "$DESTINO"
# Tudo o que o app precisa para rodar sozinho a partir dessa pasta.
cp index.html sw.js manifest.webmanifest config.js icon.svg "$DESTINO/" 2>/dev/null
cp icon-*.png *.webp "$DESTINO/" 2>/dev/null
echo "guardada a versão $VERSAO em $DESTINO"

# Só as cinco últimas ficam. Ordena por número de versão, não por texto:
# em ordem de texto a 5.10.0 viria antes da 5.9.0 e eu apagaria a errada.
GUARDADAS=$(ls -1 versoes 2>/dev/null | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -t. -k1,1n -k2,2n -k3,3n)
TOTAL=$(echo "$GUARDADAS" | grep -c .)
if [ "$TOTAL" -gt 5 ]; then
  echo "$GUARDADAS" | head -n $((TOTAL - 5)) | while read -r velha; do
    rm -rf "versoes/$velha"
    echo "tirei a versão antiga $velha"
  done
fi

# A página que lista o que está guardado.
{
  echo '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">'
  echo '<meta name="viewport" content="width=device-width, initial-scale=1">'
  echo '<title>Versões do Finanz</title><style>'
  echo 'body{background:#050506;color:#F4F0E7;font:16px/1.55 system-ui,sans-serif;margin:0;padding:28px 20px 40px}'
  echo 'h1{font-size:20px;letter-spacing:.14em;color:#E9B44C;font-weight:600;margin:0 0 4px}'
  echo 'p{color:#A79C89;font-size:14px;max-width:34em}'
  echo 'a.v{display:flex;justify-content:space-between;align-items:center;gap:12px;'
  echo 'border:1px solid rgba(198,158,78,.26);border-radius:14px;padding:15px 16px;'
  echo 'margin-top:10px;color:#F4F0E7;text-decoration:none}'
  echo 'a.v small{color:#7C7362;font-size:12px}'
  echo '.agora{border-color:#E9B44C}'
  echo 'a.voltar{color:#E9B44C;text-decoration:none;font-size:14px;display:inline-block;margin-bottom:14px}'
  echo 'p.aviso{border-left:2px solid #E9B44C;padding-left:12px;color:#C9BFA8}'
  echo '#tudo{display:none}'
  echo '</style></head><body>'
  echo '<a class="voltar" href="../">‹ Voltar ao app</a>'
  echo '<h1>F I N A N Z</h1>'
  echo '<div id="barrado"><p>Esta página é da manutenção do app. Entre com a conta'
  echo 'do administrador para vê-la.</p></div>'
  echo '<div id="tudo">'
  echo '<p>Versões guardadas. A de cima é a que está no ar. Se uma atualização'
  echo 'estragar alguma coisa, abra a de baixo — seus dados continuam os mesmos,'
  echo 'porque ficam guardados no aparelho e não dentro da versão.</p>'
  echo '<p class="aviso"><b>Feche o app nas outras abas antes.</b> Cada versão'
  echo 'guardada é um app inteiro apontando para o mesmo servidor. Duas abertas'
  echo 'na mesma conta mandam versões diferentes dos seus dados e ficam'
  echo 'desfazendo uma à outra — é assim que o saldo começa a mudar sozinho.</p>'
  echo '<p class="aviso">Por isso a versão guardada abre <b>desconectada</b>: ela'
  echo 'enxerga os dados deste aparelho (dá para olhar e salvar um backup), mas'
  echo 'não sincroniza sozinha. Para sincronizar é preciso entrar na conta ali'
  echo 'dentro, de propósito.</p>'
  echo "<a class=\"v agora\" href=\"../\"><span>Versão $VERSAO</span><small>no ar agora</small></a>"
  ls -1 versoes | grep -E '^[0-9]+\.[0-9]+\.[0-9]+$' | sort -t. -k1,1nr -k2,2nr -k3,3nr | while read -r v; do
    [ "$v" = "$VERSAO" ] && continue
    echo "<a class=\"v\" href=\"$v/\"><span>Versão $v</span><small>guardada</small></a>"
  done
  echo '<p style="margin-top:26px">Abrindo uma versão antiga, o atalho da tela inicial'
  echo 'continua apontando para a de cima. Para voltar de vez, é só usar o endereço'
  echo 'normal do app.</p>'
  echo '</div>'
  # A lista só aparece para a conta dona do app. Isto é tranca de porta, não
  # cofre: os arquivos ficam num site público e quem souber o endereço de uma
  # versão abre direto. Serve para o app não oferecer manutenção a quem não é
  # da manutenção; não serve para esconder nada de quem procura.
  echo '<script src="../config.js"></script>'
  echo '<script>'
  echo '(function () {'
  echo '  var dono = ((window.FINANZ_CONFIG || {}).dono || "").trim().toLowerCase();'
  echo '  var quem = "";'
  echo '  try {'
  echo '    var s = JSON.parse(localStorage.getItem("caixa.nuvem.v3") || "null");'
  echo '    quem = (s && s.usuario && s.usuario.email || "").trim().toLowerCase();'
  echo '  } catch (e) { quem = ""; }'
  echo '  if (!dono || quem === dono) {'
  echo '    document.getElementById("tudo").style.display = "block";'
  echo '    document.getElementById("barrado").style.display = "none";'
  echo '  }'
  echo '}());'
  echo '</script>'
  echo '</body></html>'
} > versoes/index.html
echo "versoes/index.html atualizado"

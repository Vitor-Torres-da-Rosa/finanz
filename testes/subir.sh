#!/bin/bash
# Levanta o que os testes precisam: Postgres, o emulador do Supabase e o
# servidor do app. Rodar quantas vezes quiser: o que já está de pé fica.
cd "$(dirname "$0")" || exit 1
PGBIN=/usr/lib/postgresql/16/bin

# O servidor dos testes serve uma CÓPIA do app, e só o preparar.sh a
# copiava. Esquecendo de rodá-lo, a suíte inteira passava testando o
# index.html de antes da mudança — verde por motivo nenhum. Agora a cópia
# se refaz a cada rodada; o servir.cjs lê do disco a cada pedido, então
# ela vale na hora, sem reiniciar nada.
mkdir -p appteste
cp ../index.html ../sw.js ../manifest.webmanifest ../icon.svg appteste/ 2>/dev/null
cp ../icon-*.png ../*.webp appteste/ 2>/dev/null
cp config-teste.js appteste/config.js

if ! su postgres -c "$PGBIN/pg_isready -h /tmp -p 55433" >/dev/null 2>&1; then
  rm -f /tmp/pgcaixa/postmaster.pid
  su postgres -c "$PGBIN/pg_ctl -D /tmp/pgcaixa -l /tmp/pg.log \
    -o '-p 55433 -k /tmp -c listen_addresses=' start" >/dev/null 2>&1
  for _ in $(seq 1 20); do
    su postgres -c "$PGBIN/pg_isready -h /tmp -p 55433" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi

# O emulador guarda a conexão com o banco: se o banco caiu, ele precisa
# renascer. E se o PRÓPRIO emulador mudou, também: ele é um processo que
# já está de pé, então editar o arquivo não muda nada até reiniciar. Essa
# é a mesma armadilha da cópia velha do app — o teste roda contra o código
# de antes e fica verde por motivo nenhum.
EMU_AGORA=$(stat -c %Y emulador.mjs 2>/dev/null || echo 0)
EMU_ANTES=$(cat /tmp/emu.mtime 2>/dev/null || echo 0)
if ! curl -s -o /dev/null --max-time 2 http://127.0.0.1:54321/rest/v1/perfis \
   || [ "$EMU_AGORA" != "$EMU_ANTES" ]; then
  # Comparação exata dos argumentos, não "pgrep -f": o -f casa com a linha
  # de comando de QUEM está rodando isto, que também contém o texto da
  # busca. O script matava o próprio shell que o chamou.
  for pid in $(ps -eo pid=,args= | awk '$2=="node" && $3=="emulador.mjs" {print $1}'); do
    kill "$pid" 2>/dev/null
  done
  sleep 1
  setsid node emulador.mjs >/tmp/emu.log 2>&1 < /dev/null &
  echo "$EMU_AGORA" > /tmp/emu.mtime
fi

# Mesma história do emulador: o servidor dos testes também é um processo
# de pé, e editar servir.cjs não muda nada até ele renascer.
SRV_AGORA=$(stat -c %Y servir.cjs 2>/dev/null || echo 0)
SRV_ANTES=$(cat /tmp/servir.mtime 2>/dev/null || echo 0)
if ! curl -s -o /dev/null --max-time 2 http://127.0.0.1:8833/index.html \
   || [ "$SRV_AGORA" != "$SRV_ANTES" ]; then
  for pid in $(ps -eo pid=,args= | awk '$2=="node" && $3=="servir.cjs" {print $1}'); do
    kill "$pid" 2>/dev/null
  done
  sleep 1
  setsid node servir.cjs appteste 8833 >/tmp/servir.log 2>&1 < /dev/null &
  echo "$SRV_AGORA" > /tmp/servir.mtime
fi

for _ in $(seq 1 20); do
  a=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:54321/rest/v1/perfis)
  b=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:8833/index.html)
  [ "$a" = "401" ] && [ "$b" = "200" ] && echo "tudo de pé (emulador $a, app $b)" && exit 0
  sleep 0.5
done
echo "NÃO SUBIU: emulador=$a app=$b — rode testes/preparar.sh"; exit 1

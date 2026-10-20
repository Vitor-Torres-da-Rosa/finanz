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

# O emulador guarda a conexão com o banco: se o banco caiu, ele precisa renascer.
if ! curl -s -o /dev/null --max-time 2 http://127.0.0.1:54321/rest/v1/perfis; then
  pkill -f emulador.mjs >/dev/null 2>&1
  sleep 1
  setsid node emulador.mjs >/tmp/emu.log 2>&1 < /dev/null &
fi

if ! curl -s -o /dev/null --max-time 2 http://127.0.0.1:8833/index.html; then
  pkill -f "servir.cjs" >/dev/null 2>&1
  sleep 1
  setsid node servir.cjs appteste 8833 >/tmp/servir.log 2>&1 < /dev/null &
fi

for _ in $(seq 1 20); do
  a=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:54321/rest/v1/perfis)
  b=$(curl -s -o /dev/null -w '%{http_code}' --max-time 2 http://127.0.0.1:8833/index.html)
  [ "$a" = "401" ] && [ "$b" = "200" ] && echo "tudo de pé (emulador $a, app $b)" && exit 0
  sleep 0.5
done
echo "NÃO SUBIU: emulador=$a app=$b — rode testes/preparar.sh"; exit 1

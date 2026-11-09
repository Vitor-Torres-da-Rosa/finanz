#!/bin/bash
# Deixa o container pronto para rodar os testes. Roda uma vez por sessão;
# rodar de novo não estraga nada, ele só refaz o que estiver faltando.
#
#   testes/preparar.sh
set -u
cd "$(dirname "$0")" || exit 1
AQUI="$(pwd)"
PGBIN=/usr/lib/postgresql/16/bin
PGDIR=/tmp/pgcaixa
PORTA=55433

passo() { echo; echo "--- $1"; }

passo "Postgres"
if [ ! -x "$PGBIN/pg_ctl" ]; then
  echo "instalando (leva um tempo na primeira vez)..."
  apt-get update -qq >/dev/null 2>&1
  DEBIAN_FRONTEND=noninteractive apt-get install -y -qq postgresql-16 >/dev/null 2>&1 \
    || { echo "não consegui instalar o postgresql-16"; exit 1; }
fi
if [ ! -d "$PGDIR/base" ]; then
  echo "criando o banco em $PGDIR"
  mkdir -p "$PGDIR" && chown postgres:postgres "$PGDIR"
  su postgres -c "$PGBIN/initdb -D $PGDIR -E UTF8 --locale=C.UTF-8" >/dev/null 2>&1 \
    || { echo "initdb falhou"; exit 1; }
fi
if ! su postgres -c "$PGBIN/pg_isready -h /tmp -p $PORTA" >/dev/null 2>&1; then
  rm -f "$PGDIR/postmaster.pid"
  su postgres -c "$PGBIN/pg_ctl -D $PGDIR -l /tmp/pg.log \
    -o '-p $PORTA -k /tmp -c listen_addresses=' start" >/dev/null 2>&1
  for _ in $(seq 1 30); do
    su postgres -c "$PGBIN/pg_isready -h /tmp -p $PORTA" >/dev/null 2>&1 && break
    sleep 0.5
  done
fi
su postgres -c "$PGBIN/pg_isready -h /tmp -p $PORTA" >/dev/null 2>&1 \
  || { echo "o Postgres não subiu; veja /tmp/pg.log"; exit 1; }
echo "de pé na porta $PORTA"

passo "banco caixa_app"
su postgres -c "$PGBIN/psql -h /tmp -p $PORTA -lqt" | cut -d'|' -f1 | grep -qw caixa_app \
  || su postgres -c "$PGBIN/createdb -h /tmp -p $PORTA caixa_app"
# O auth do Supabase não existe aqui: o stub imita o pedaço que o schema usa.
su postgres -c "$PGBIN/psql -h /tmp -p $PORTA -d caixa_app -q -f $AQUI/stub-auth.sql" >/dev/null
for arquivo in ../supabase/schema.sql ../supabase/migracao-*.sql; do
  [ -f "$arquivo" ] || continue
  su postgres -c "$PGBIN/psql -h /tmp -p $PORTA -d caixa_app -q -f $AQUI/$arquivo" >/dev/null 2>&1
done
echo "tabelas: $(su postgres -c "$PGBIN/psql -h /tmp -p $PORTA -d caixa_app -tAc \
  \"select count(*) from information_schema.tables where table_schema='public'\"")"

passo "módulo pg (o emulador fala com o banco por ele)"
if [ ! -d node_modules/pg ]; then
  npm install --silent --no-audit --no-fund pg >/dev/null 2>&1 \
    || { echo "npm install pg falhou; sem rede?"; exit 1; }
fi
echo "ok"

passo "cópia do app para os testes"
mkdir -p appteste
cp ../index.html ../sw.js ../manifest.webmanifest ../icon.svg appteste/ 2>/dev/null
cp ../icon-*.png ../*.webp appteste/ 2>/dev/null
rm -rf appteste/leitor; cp -r ../leitor appteste/ 2>/dev/null
cp config-teste.js appteste/config.js
echo "appteste/ atualizado"

passo "Playwright"
node -e "import('playwright').catch(()=>import('/opt/node22/lib/node_modules/playwright/index.mjs'))
  .then(()=>console.log('encontrado')).catch(()=>{console.log('NÃO ENCONTRADO');process.exit(1)})" \
  || { echo "o Playwright não está na imagem"; exit 1; }

echo; echo "pronto. agora: node testes/rodar.mjs"

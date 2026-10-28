#!/usr/bin/env bash
# Sobe um Postgres temporário, aplica stubs + migrações e roda tests/db_test.sql.
# Uso: npm run test:db   (requer binários do PostgreSQL; roda como o usuário "postgres" se for root)
set -euo pipefail
cd "$(dirname "$0")/.."
BIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
DIR=$(mktemp -d); PORT=54399
if [ "$(id -u)" = "0" ]; then RUN="su postgres -c"; chown postgres "$DIR"; chmod -R a+rX "$(pwd)"; else RUN="bash -c"; fi
$RUN "$BIN/initdb -D $DIR/data -A trust >/dev/null"
$RUN "$BIN/pg_ctl -D $DIR/data -o '-p $PORT -k $DIR -c listen_addresses=' -l $DIR/log -w start >/dev/null"
trap '$RUN "$BIN/pg_ctl -D $DIR/data -m immediate stop >/dev/null" || true; rm -rf "$DIR"' EXIT
P="$BIN/psql -h $DIR -p $PORT -U postgres -d postgres -X -q -v ON_ERROR_STOP=1"
FAILED=0
for f in tests/stubs.sql migrations/*.sql tests/db_test.sql tests/db_test_2.sql tests/db_test_3.sql; do
  $RUN "$P -t -A -f $(pwd)/$f" > "$DIR/out.txt" 2>&1 || { echo "ERRO em $f"; grep -E "ERROR|DETAIL|LINE" "$DIR/out.txt"; exit 1; }
  grep -E "^(FAIL|PASS)" "$DIR/out.txt" || true
  ! grep -q "^FAIL" "$DIR/out.txt" || FAILED=1
done
[ "$FAILED" = 0 ]

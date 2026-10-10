#!/usr/bin/env bash
# Uso: PGHOST=/tmp PGPORT=54399 PGUSER=postgres ./supabase/tests/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."
psql -qc "drop database if exists rls_test" -c "create database rls_test"
for f in tests/stubs.sql migrations/*.sql; do psql -d rls_test -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>&1; done
psql -d rls_test -q -f tests/rls_test.sql | grep -E "FAIL|passou|^ +[0-9]+ \|"

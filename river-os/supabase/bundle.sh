#!/usr/bin/env bash
# Gera supabase/apply-all.sql (todas as migrações em ordem) para colar no SQL Editor do Supabase.
# Prefira `supabase db push` quando usar a CLI; este arquivo é a alternativa sem CLI.
set -euo pipefail
cd "$(dirname "$0")"
out=apply-all.sql
{ echo "-- RIVER OS — todas as migrações em ordem. Gerado por supabase/bundle.sh; não edite."; for f in migrations/*.sql; do printf '\n-- ══════ %s ══════\n' "$f"; cat "$f"; done; } > "$out"
echo "gerado $out ($(wc -l < "$out") linhas, $(ls migrations/*.sql | wc -l) migrações)"

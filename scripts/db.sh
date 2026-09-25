#!/usr/bin/env bash
# Database test harness. Production is never a target: there is no command
# here that reads production credentials except to refuse them.
#
#   scripts/db.sh local            Fresh local Postgres 16 database: the Supabase
#                                  shim, schema.sql, every migration in order,
#                                  then the tests. Needs `brew install postgresql@16`.
#   scripts/db.sh staging:target   Print which Supabase project staging points at.
#   scripts/db.sh staging:migrate FILE...
#                                  Apply SQL files to STAGING, in the order given.
#   scripts/db.sh staging:test     Run the tests against STAGING (they roll back).
#
# Staging credentials live in .env.staging.local (gitignored), never .env.local:
#   NEXT_PUBLIC_SUPABASE_URL=https://<staging-ref>.supabase.co
#   STAGING_DB_URL=postgresql://postgres.<staging-ref>:<password>@<host>:5432/postgres

set -euo pipefail
export LC_ALL="${LC_ALL:-en_US.UTF-8}"  # the Homebrew postmaster refuses to start without it

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PG_BIN="${PG_BIN:-/opt/homebrew/opt/postgresql@16/bin}"
PSQL="$PG_BIN/psql"
TESTS="$ROOT/supabase/tests/hackathons_test.sql"
PASS_PATTERN='ALL [0-9]+ TESTS PASSED'

# Every migration, in numeric order.
migrations() { ls "$ROOT"/supabase/migrations/[0-9][0-9][0-9]_*.sql | sort; }

# The test file ends by raising an exception on purpose, so that everything it
# did rolls back even in the Supabase SQL editor. Success is that exception
# saying every test passed.
run_tests() {
  local out
  out="$("$PSQL" "$@" -X -q -v ON_ERROR_STOP=1 -f "$TESTS" 2>&1 || true)"
  echo "$out" | grep -E '^(ERROR|psql):' | sed 's/^ERROR:  //'
  echo "$out" | grep -qE "$PASS_PATTERN"
}

env_value() { # file key
  [ -f "$1" ] || return 0
  { grep -E "^$2=" "$1" || true; } | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//'
}

ref_from_url() { # https://<ref>.supabase.co -> <ref>
  echo "$1" | sed -E 's#^https?://([a-z0-9]+)\.supabase\.co.*#\1#'
}

staging_url() {
  local file="$ROOT/.env.staging.local"
  local url staging_ref prod_ref
  url="$(env_value "$file" STAGING_DB_URL)"
  staging_ref="$(ref_from_url "$(env_value "$file" NEXT_PUBLIC_SUPABASE_URL)")"
  prod_ref="$(ref_from_url "$(env_value "$ROOT/.env.local" NEXT_PUBLIC_SUPABASE_URL)")"

  if [ -z "$url" ] || [ -z "$staging_ref" ]; then
    echo "Missing STAGING_DB_URL or NEXT_PUBLIC_SUPABASE_URL in .env.staging.local" >&2
    exit 1
  fi
  if [ -n "$prod_ref" ] && [[ "$url" == *"$prod_ref"* || "$staging_ref" == "$prod_ref" ]]; then
    echo "REFUSING: the staging settings point at the production project ($prod_ref)." >&2
    exit 1
  fi
  if [[ "$url" != *"$staging_ref"* ]]; then
    echo "REFUSING: STAGING_DB_URL is not for project $staging_ref (NEXT_PUBLIC_SUPABASE_URL)." >&2
    exit 1
  fi
  STAGING_REF="$staging_ref"
  STAGING_DB_URL="$url"
}

case "${1:-}" in
  local)
    DATA="${TMPDIR:-/tmp}/quorum-pg16"
    PORT=54329
    if [ ! -d "$DATA" ]; then
      "$PG_BIN/initdb" -D "$DATA" -U postgres --auth=trust -E UTF8 >/dev/null
    fi
    if ! "$PG_BIN/pg_ctl" -D "$DATA" status >/dev/null 2>&1; then
      "$PG_BIN/pg_ctl" -D "$DATA" -o "-p $PORT -k $DATA" -l "$DATA/server.log" -w start >/dev/null
    fi
    CONN=(-h "$DATA" -p "$PORT" -U postgres)
    export PGOPTIONS="-c client_min_messages=warning"  # hide the migrations' "does not exist, skipping" notices
    "$PSQL" "${CONN[@]}" -X -q -d postgres -c "drop database if exists quorum_test" -c "create database quorum_test"
    echo "Fresh local database: quorum_test"
    for f in "$ROOT/supabase/tests/local/supabase_shim.sql" "$ROOT/supabase/schema.sql" $(migrations); do
      echo "  applying ${f#$ROOT/}"
      "$PSQL" "${CONN[@]}" -d quorum_test -X -q -v ON_ERROR_STOP=1 -f "$f" >/dev/null
    done
    echo "Running tests"
    run_tests "${CONN[@]}" -d quorum_test
    ;;
  staging:target)
    staging_url
    echo "Staging target: project $STAGING_REF"
    ;;
  staging:migrate)
    shift
    staging_url
    [ "$#" -gt 0 ] || { echo "Name the SQL files to apply." >&2; exit 1; }
    echo "Applying to STAGING project $STAGING_REF:"
    for f in "$@"; do
      echo "  $f"
      "$PSQL" "$STAGING_DB_URL" -X -q -v ON_ERROR_STOP=1 -1 -f "$f" >/dev/null
    done
    ;;
  staging:test)
    staging_url
    echo "Running tests against STAGING project $STAGING_REF"
    run_tests "$STAGING_DB_URL"
    ;;
  *)
    sed -n '2,16p' "$0"
    exit 1
    ;;
esac

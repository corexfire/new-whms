#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if ! command -v psql >/dev/null 2>&1; then
  echo "psql tidak ditemukan. Install PostgreSQL client (psql) dulu."
  exit 1
fi

if [ ! -x "./node_modules/.bin/prisma" ]; then
  echo "Prisma CLI tidak ditemukan di whms-backend/node_modules. Jalankan npm ci terlebih dulu."
  exit 1
fi

want_seed="false"
for arg in "$@"; do
  case "$arg" in
    --seed) want_seed="true" ;;
    --help|-h)
      cat <<'TXT'
Usage:
  ./provision-postgres.sh [--seed]

Env yang dipakai:
  DATABASE_URL                 postgresql://user:pass@host:port/db?schema=public
  PGADMIN_USER                 default: postgres
  PGADMIN_PASSWORD             optional (kalau butuh password)
  PGADMIN_HOST                 default: host dari DATABASE_URL
  PGADMIN_PORT                 default: port dari DATABASE_URL (atau 5432)
  PGADMIN_DB                   default: postgres

Contoh:
  export DATABASE_URL='postgresql://whms:secret@127.0.0.1:5432/whms_db?schema=public'
  export PGADMIN_USER='postgres'
  export PGADMIN_PASSWORD='postgres'
  ./provision-postgres.sh --seed
TXT
      exit 0
      ;;
  esac
done

db_url="${DATABASE_URL:-}"
if [ -z "$db_url" ] && [ -f ".env" ]; then
  db_url="$(grep -E '^DATABASE_URL=' .env | head -n 1 | sed -E 's/^DATABASE_URL=//')"
  db_url="${db_url%\"}"
  db_url="${db_url#\"}"
  db_url="${db_url%\'}"
  db_url="${db_url#\'}"
fi

if [ -z "$db_url" ]; then
  echo "DATABASE_URL belum di-set (env) dan .env tidak ditemukan/berisi DATABASE_URL."
  exit 1
fi

parsed="$(
  DB_URL="$db_url" node <<'NODE'
const dbUrl = process.env.DB_URL;
try {
  const u = new URL(dbUrl);
  const user = decodeURIComponent(u.username || '');
  const pass = decodeURIComponent(u.password || '');
  const host = u.hostname || 'localhost';
  const port = u.port ? Number(u.port) : 5432;
  const db = (u.pathname || '').replace(/^\//, '') || '';
  if (!user || !db) throw new Error('DATABASE_URL harus mengandung username dan database name');
  process.stdout.write(JSON.stringify({ user, pass, host, port, db }));
} catch (e) {
  console.error(String(e?.message || e));
  process.exit(1);
}
NODE
)"

DB_USER="$(node -e "console.log(JSON.parse(process.argv[1]).user)" "$parsed")"
DB_PASS="$(node -e "console.log(JSON.parse(process.argv[1]).pass)" "$parsed")"
DB_HOST="$(node -e "console.log(JSON.parse(process.argv[1]).host)" "$parsed")"
DB_PORT="$(node -e "console.log(JSON.parse(process.argv[1]).port)" "$parsed")"
DB_NAME="$(node -e "console.log(JSON.parse(process.argv[1]).db)" "$parsed")"

PGADMIN_USER="${PGADMIN_USER:-postgres}"
PGADMIN_HOST="${PGADMIN_HOST:-$DB_HOST}"
PGADMIN_PORT="${PGADMIN_PORT:-$DB_PORT}"
PGADMIN_DB="${PGADMIN_DB:-postgres}"

if [ -n "${PGADMIN_PASSWORD:-}" ]; then
  export PGPASSWORD="$PGADMIN_PASSWORD"
fi

psql "postgresql://${PGADMIN_USER}@${PGADMIN_HOST}:${PGADMIN_PORT}/${PGADMIN_DB}" -v ON_ERROR_STOP=1 \
  -v role_name="$DB_USER" \
  -v role_pass="$DB_PASS" \
  -v db_name="$DB_NAME" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role_name', :'role_pass')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role_name');
\gexec

SELECT format('ALTER ROLE %I WITH LOGIN PASSWORD %L', :'role_name', :'role_pass')
WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role_name');
\gexec

SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'role_name')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name');
\gexec

SELECT format('GRANT ALL PRIVILEGES ON DATABASE %I TO %I', :'db_name', :'role_name');
\gexec
SQL

psql "postgresql://${PGADMIN_USER}@${PGADMIN_HOST}:${PGADMIN_PORT}/${DB_NAME}" -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
SQL

export DATABASE_URL="$db_url"

if [ -d "prisma/migrations" ] && [ -n "$(ls -A prisma/migrations 2>/dev/null || true)" ]; then
  ./node_modules/.bin/prisma migrate deploy
else
  ./node_modules/.bin/prisma db push
fi

if [ "$want_seed" = "true" ]; then
  ./node_modules/.bin/prisma db seed
fi

echo "OK: database='${DB_NAME}' user='${DB_USER}' host='${DB_HOST}' port='${DB_PORT}'"

#!/usr/bin/env bash
#
# Start the TTRPG Companion app on your own machine.
#
#   ./start.sh              start the app on http://localhost:3000
#   ./start.sh --port 4000  listen somewhere other than port 3000
#   ./start.sh --help       show this message
#
# This is for development. On a server, systemd starts the app instead.
# See deploy/setup-ec2.sh and deploy/ttrpg-companion.service.
#
# Works on Linux, which is the deployment target for this project.

set -euo pipefail

REQUIRED_NODE_MAJOR=20
REQUIRED_POSTGRES_MAJOR=14
PORT_OVERRIDE=""

say() {
    printf '==> %s\n' "$1"
}

die() {
    printf 'ERROR: %s\n' "$1" >&2
    exit 1
}

usage() {
    awk 'NR > 1 {
        if (/^#/) {
            sub(/^# ?/, "")
            print
        } else {
            exit
        }
    }' "$0"
    exit 0
}

# --- options ----------------------------------------------------------------

while [ $# -gt 0 ]; do
    case "$1" in
        -p|--port)
            [ $# -ge 2 ] || die "--port needs a number, for example: --port 4000"
            case "$2" in
                ''|*[!0-9]*) die "--port needs a number, got '$2'" ;;
            esac
            PORT_OVERRIDE="$2"
            shift 2
            ;;
        -h|--help)
            usage
            ;;
        *)
            die "unknown option '$1' (try --help)"
            ;;
    esac
done

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

command -v openssl >/dev/null 2>&1 \
    || die "openssl is required to generate a private local database password."

# Load private local configuration. The file is ignored by git; copy
# .env.example to .env to customize it.
if [ -f .env ]; then
    set -a
    # shellcheck disable=SC1091
    . ./.env
    set +a
fi

DB_NAME="${DB_NAME:-ttrpg_companion}"
DB_USER="${DB_USER:-ttrpg_app}"
DB_PASSWORD="${DB_PASSWORD:-}"
DB_HOST="${DB_HOST:-127.0.0.1}"
DB_PORT="${DB_PORT:-5432}"

case "$DB_NAME" in
    ''|*[!a-zA-Z0-9_]*)
        die "DB_NAME may contain only letters, numbers, and underscores."
        ;;
esac
case "$DB_USER" in
    ''|*[!a-zA-Z0-9_]*)
        die "DB_USER may contain only letters, numbers, and underscores."
        ;;
esac

if [ -z "$DB_PASSWORD" ]; then
    umask 077
    DB_PASSWORD="$(openssl rand -hex 24 2>/dev/null || true)"
    [ -n "$DB_PASSWORD" ] || die "DB_PASSWORD is missing and openssl could not generate one. Copy .env.example to .env and set DB_PASSWORD."
    printf 'DB_NAME=%s\nDB_USER=%s\nDB_PASSWORD=%s\nDB_HOST=%s\nDB_PORT=%s\n' \
        "$DB_NAME" "$DB_USER" "$DB_PASSWORD" "$DB_HOST" "$DB_PORT" > .env
    say "Created private .env with a generated local database password."
fi

# --- 1. check required tools -----------------------------------------------

say "Checking required tools..."

if [ "$(uname -s)" != "Linux" ]; then
    die "this script requires Linux, the deployment target for this app"
fi

command -v sudo >/dev/null 2>&1 \
    || die "sudo is required to install dependencies and start PostgreSQL."

command -v openssl >/dev/null 2>&1 \
    || die "openssl is required to generate a private local database password."

command -v node >/dev/null 2>&1 \
    || die "Node.js is not installed. Install Node.js ${REQUIRED_NODE_MAJOR} or newer from https://nodejs.org."

if ! node -e "process.exit(Number(process.versions.node.split('.')[0]) >= ${REQUIRED_NODE_MAJOR} ? 0 : 1)"; then
    die "Node $(node --version) is too old. This app needs Node.js ${REQUIRED_NODE_MAJOR} or newer."
fi

command -v npm >/dev/null 2>&1 \
    || die "npm is not installed. Reinstall Node.js ${REQUIRED_NODE_MAJOR} or newer from https://nodejs.org."

# Automatically install PostgreSQL if missing
if ! command -v psql >/dev/null 2>&1 || ! command -v pg_isready >/dev/null 2>&1; then
    say "PostgreSQL is not installed. Installing PostgreSQL..."
    sudo apt-get update
    sudo apt-get install -y postgresql postgresql-contrib
fi

command -v psql >/dev/null 2>&1 \
    || die "PostgreSQL client installation failed."

command -v pg_isready >/dev/null 2>&1 \
    || die "PostgreSQL tools are incomplete: pg_isready is missing."

[ -f package.json ] || die "package.json is missing from $PROJECT_DIR."
[ -f server.js ] || die "server.js is missing from $PROJECT_DIR."

# --- 2. install project dependencies ---------------------------------------

say "Installing project dependencies..."
npm install --no-audit --no-fund

# --- 3. create application data --------------------------------------------

say "Checking application initialization..."
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1; then
    say "Starting PostgreSQL..."
    sudo systemctl start postgresql
fi

pg_isready -h "$DB_HOST" -p "$DB_PORT" >/dev/null 2>&1 \
    || die "PostgreSQL is installed but is not accepting connections on ${DB_HOST}:${DB_PORT}."

if sudo -u postgres psql -v db_user="$DB_USER" -tA <<'SQL' | grep -q 1
SELECT 1 FROM pg_roles WHERE rolname = :'db_user';
SQL
then
    sudo -u postgres psql -v ON_ERROR_STOP=1 \
        -v db_user="$DB_USER" \
        -v db_password="$DB_PASSWORD" <<'SQL'
ALTER ROLE :"db_user" WITH LOGIN PASSWORD :'db_password';
SQL
else
    sudo -u postgres psql -v ON_ERROR_STOP=1 \
        -v db_user="$DB_USER" \
        -v db_password="$DB_PASSWORD" <<'SQL'
CREATE ROLE :"db_user" LOGIN PASSWORD :'db_password';
SQL
fi

if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1; then
    sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi

export DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}"
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    -c "GRANT ALL ON SCHEMA public TO \"$DB_USER\";"
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 <<'SQL'
CREATE TABLE IF NOT EXISTS app_metadata (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO app_metadata (key, value)
VALUES ('schema_version', '1')
ON CONFLICT (key) DO NOTHING;
SQL

# --- 4. start the app -------------------------------------------------------

if [ -n "$PORT_OVERRIDE" ]; then
    export PORT="$PORT_OVERRIDE"
fi

export HOST="${HOST:-0.0.0.0}" #This is just for my setup testing
#export HOST="${HOST:-127.0.0.1}"
PORT_TO_OPEN="${PORT_OVERRIDE:-${PORT:-3000}}"
say "Starting the app on ${HOST}:${PORT_TO_OPEN}/"
say "Press Ctrl+C to stop the server."

exec node server.js

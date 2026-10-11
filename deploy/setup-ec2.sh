#!/usr/bin/env bash
set -Eeuo pipefail

if [[ "${EUID}" -ne 0 ]]; then
  echo "Run this script with sudo: sudo bash deploy/setup-ec2.sh" >&2
  exit 1
fi

APP_NAME="ttrpg-companion"
APP_USER="${SUDO_USER:-ubuntu}"
APP_DIR="/opt/${APP_NAME}"
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${APP_DIR}/.env"

apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y ca-certificates curl nginx postgresql postgresql-contrib rsync

if ! command -v node >/dev/null 2>&1 || [[ "$(node -p 'process.versions.node.split(".")[0]')" -lt 20 ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs
fi

install -d -o "$APP_USER" -g "$APP_USER" "$APP_DIR"
if [[ ! -f "$ENV_FILE" ]]; then
  DB_PASSWORD="$(openssl rand -hex 24)"
  umask 077
  cat > "$ENV_FILE" <<EOF
DB_NAME=ttrpg_companion
DB_USER=ttrpg_app
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=127.0.0.1
DB_PORT=5432
DATABASE_URL=postgresql://ttrpg_app:${DB_PASSWORD}@127.0.0.1:5432/ttrpg_companion
EOF
  chown "$APP_USER:$APP_USER" "$ENV_FILE"
  chmod 0600 "$ENV_FILE"
fi
# shellcheck disable=SC1090
source "$ENV_FILE"
systemctl enable --now postgresql
if sudo -u postgres psql --set=DB_USER="$DB_USER" -tA <<'SQL' | grep -q 1
SELECT 1 FROM pg_roles WHERE rolname = :'DB_USER';
SQL
then
  sudo -u postgres psql -v ON_ERROR_STOP=1 \
    --set=DB_USER="$DB_USER" \
    --set=DB_PASSWORD="$DB_PASSWORD" <<'SQL'
ALTER ROLE :"DB_USER" WITH LOGIN PASSWORD :'DB_PASSWORD';
SQL
else
  sudo -u postgres psql -v ON_ERROR_STOP=1 \
    --set=DB_USER="$DB_USER" \
    --set=DB_PASSWORD="$DB_PASSWORD" <<'SQL'
CREATE ROLE :"DB_USER" LOGIN PASSWORD :'DB_PASSWORD';
SQL
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
  sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi
sudo -u postgres psql -d "$DB_NAME" -c "GRANT ALL ON SCHEMA public TO \"$DB_USER\";"
install -m 0644 "$SCRIPT_DIR/${APP_NAME}.service" "/etc/systemd/system/${APP_NAME}.service"
install -m 0644 "$SCRIPT_DIR/nginx-${APP_NAME}.conf" "/etc/nginx/sites-available/${APP_NAME}"
ln -sfn "/etc/nginx/sites-available/${APP_NAME}" "/etc/nginx/sites-enabled/${APP_NAME}"
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl daemon-reload
systemctl enable nginx "${APP_NAME}.service"
systemctl restart nginx

echo "EC2 runtime is ready. Copy the application with deploy/deploy.sh from your laptop."
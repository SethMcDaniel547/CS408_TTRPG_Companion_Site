#!/usr/bin/env bash
#
# One-time setup for a fresh EC2 instance.
#
# Copy deploy/ to the server and run:
#   sudo bash deploy/setup-ec2.sh
#
# The script installs Node.js, PostgreSQL, nginx, and rsync, creates the
# application directory, and registers the application with systemd. Run
# deploy/deploy.sh from your laptop after this setup completes.

set -Eeuo pipefail

APP_NAME="ttrpg-companion"
APP_DIR="/opt/${APP_NAME}"
APP_USER="ttrpg"
DEPLOY_USER="${SUDO_USER:-}"
NODE_MAJOR="20"
DB_NAME="ttrpg_companion"
DB_USER="ttrpg_app"
DB_HOST="127.0.0.1"
DB_PORT="5432"

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"

say() {
    printf '\n==> %s\n' "$1"
}

die() {
    printf 'ERROR: %s\n' "$1" >&2
    exit 1
}

[ "$(id -u)" -eq 0 ] || die "run this with sudo: sudo bash $0"
[ -r /etc/os-release ] || die "cannot read /etc/os-release; unsupported system"
# shellcheck disable=SC1091
. /etc/os-release

case "${ID:-}" in
    amzn|rhel|centos|fedora)
        PKG="dnf"
        DEPLOY_USER="${DEPLOY_USER:-ec2-user}"
        ;;
    ubuntu|debian)
        PKG="apt"
        DEPLOY_USER="${DEPLOY_USER:-ubuntu}"
        export DEBIAN_FRONTEND=noninteractive
        ;;
    *)
        die "unsupported distribution '${ID:-unknown}'; expected Amazon Linux or Ubuntu"
        ;;
esac

id "$DEPLOY_USER" >/dev/null 2>&1 \
    || die "deployment user '$DEPLOY_USER' does not exist"

say "Detected ${PRETTY_NAME:-$ID} (package manager: $PKG)"

say "Installing Node.js ${NODE_MAJOR}, PostgreSQL, nginx, and rsync"
if [ "$PKG" = "dnf" ]; then
    dnf -y update
    curl -fsSL "https://rpm.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    dnf -y install ca-certificates curl nginx nodejs openssl postgresql-server postgresql rsync
    if [ ! -f /var/lib/pgsql/data/PG_VERSION ]; then
        postgresql-setup --initdb
    fi
else
    apt-get update -y
    apt-get install -y ca-certificates curl gnupg nginx openssl postgresql postgresql-contrib rsync
    curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash -
    apt-get install -y nodejs
fi

say "Node $(node --version), npm $(npm --version)"

say "Creating ${APP_DIR}"
if ! id "$APP_USER" >/dev/null 2>&1; then
    useradd --system --no-create-home --shell /usr/sbin/nologin "$APP_USER"
fi
usermod -a -G "$APP_USER" "$DEPLOY_USER"
install -d -o "$DEPLOY_USER" -g "$APP_USER" -m 2770 "$APP_DIR"

ENV_FILE="${APP_DIR}/.env"
if [ ! -f "$ENV_FILE" ]; then
    DB_PASSWORD="$(openssl rand -hex 24)"
    umask 077
    cat > "$ENV_FILE" <<EOF
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DATABASE_URL=postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST}:${DB_PORT}/${DB_NAME}
EOF
fi
chown "$DEPLOY_USER:$APP_USER" "$ENV_FILE"
chmod 640 "$ENV_FILE"

# shellcheck disable=SC1090
. "$ENV_FILE"
systemctl enable --now postgresql

say "Creating the application database"
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname = '${DB_USER}'" | grep -q 1; then
    sudo -u postgres psql -v ON_ERROR_STOP=1 \
        -v db_user="$DB_USER" -v db_password="$DB_PASSWORD" \
        <<'SQL'
CREATE ROLE :"db_user" LOGIN PASSWORD :'db_password';
SQL
else
    sudo -u postgres psql -v ON_ERROR_STOP=1 \
        -v db_user="$DB_USER" -v db_password="$DB_PASSWORD" \
        <<'SQL'
ALTER ROLE :"db_user" WITH LOGIN PASSWORD :'db_password';
SQL
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname = '${DB_NAME}'" | grep -q 1; then
    sudo -u postgres createdb -O "$DB_USER" "$DB_NAME"
fi
sudo -u postgres psql -d "$DB_NAME" -v ON_ERROR_STOP=1 \
    -c "GRANT ALL ON SCHEMA public TO \"${DB_USER}\";"

say "Installing the ${APP_NAME} systemd service"
install -m 644 "$SCRIPT_DIR/${APP_NAME}.service" \
    "/etc/systemd/system/${APP_NAME}.service"
systemctl daemon-reload
systemctl enable "$APP_NAME.service"

say "Configuring nginx as a reverse proxy on port 80"
if [ "$PKG" = "dnf" ]; then
    install -m 644 "$SCRIPT_DIR/nginx-${APP_NAME}.conf" \
        "/etc/nginx/conf.d/${APP_NAME}.conf"
else
    install -m 644 "$SCRIPT_DIR/nginx-${APP_NAME}.conf" \
        "/etc/nginx/sites-available/${APP_NAME}"
    ln -sfn "/etc/nginx/sites-available/${APP_NAME}" \
        "/etc/nginx/sites-enabled/${APP_NAME}"
    rm -f /etc/nginx/sites-enabled/default
fi

if command -v getenforce >/dev/null 2>&1 && [ "$(getenforce)" != "Disabled" ]; then
    setsebool -P httpd_can_network_connect 1
fi

nginx -t
systemctl enable nginx
systemctl restart nginx

if command -v ufw >/dev/null 2>&1 && ufw status | grep -q "Status: active"; then
    say "Opening ports 80 and 22 in ufw"
    ufw allow 80/tcp
    ufw allow 22/tcp
fi

cat <<EOF

==> Server setup is complete.

The app is registered but is not running yet because no code has been
deployed. From the project folder on your laptop, run:

    ./deploy/deploy.sh -h <PUBLIC-IP-OR-DNS> -i ~/path/to/key.pem

Then open http://<PUBLIC-IP-OR-DNS>/ in a browser.
EOF

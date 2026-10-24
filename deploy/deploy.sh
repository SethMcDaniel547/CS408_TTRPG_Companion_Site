#!/usr/bin/env bash
set -Eeuo pipefail

usage() {
  echo "Usage: $0 -h <public-ip-or-hostname> -i <path-to-ssh-key> [-u <ssh-user>]"
}

HOST=""
KEY=""
USER_NAME="ubuntu"
while getopts ":h:i:u:" option; do
  case "$option" in
    h) HOST="$OPTARG" ;;
    i) KEY="$OPTARG" ;;
    u) USER_NAME="$OPTARG" ;;
    *) usage >&2; exit 2 ;;
  esac
done

if [[ -z "$HOST" || -z "$KEY" ]]; then
  usage >&2
  exit 2
fi
if ! command -v ssh >/dev/null 2>&1 || ! command -v curl >/dev/null 2>&1; then
  echo "Missing required tools: ssh and curl." >&2
  exit 1
fi
if [[ ! -f "$KEY" ]]; then
  echo "SSH key not found: $KEY" >&2
  exit 1
fi

ROOT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
REMOTE="${USER_NAME}@${HOST}"
SSH_OPTS=(-i "$KEY" -o StrictHostKeyChecking=accept-new)

echo "Checking the application before deployment..."
if command -v node >/dev/null 2>&1; then
  node --check "$ROOT_DIR/backend/server.js"
else
  echo "Node.js is not installed locally; skipping local syntax check."
fi

echo "Copying application files to ${REMOTE}..."
if command -v rsync >/dev/null 2>&1 && rsync --version >/dev/null 2>&1; then
  rsync -az --delete \
    --exclude ".git/" \
    --exclude "node_modules/" \
    --filter "protect .env" \
    -e "ssh ${SSH_OPTS[*]}" \
    "$ROOT_DIR/" "${REMOTE}:/opt/ttrpg-companion/"
else
  echo "Local rsync is unavailable or cannot start; using SSH/tar instead."
  ssh "${SSH_OPTS[@]}" "$REMOTE" \
    "find /opt/ttrpg-companion -mindepth 1 -maxdepth 1 ! -name .env -exec rm -rf -- {} +"
  tar -czf - \
    --exclude=".git" \
    --exclude="node_modules" \
    --exclude=".env" \
    -C "$ROOT_DIR" . |
    ssh "${SSH_OPTS[@]}" "$REMOTE" \
      "tar -xzf - -C /opt/ttrpg-companion"
fi

ssh "${SSH_OPTS[@]}" "$REMOTE" \
  "cd /opt/ttrpg-companion && npm install --omit=dev --no-audit --no-fund && sudo install -m 644 deploy/ttrpg-companion.service /etc/systemd/system/ttrpg-companion.service && sudo systemctl daemon-reload && sudo systemctl restart ttrpg-companion.service"

echo "Waiting for the deployed health endpoint..."
for attempt in {1..12}; do
  if curl --fail --silent --show-error --max-time 5 "http://${HOST}/api/health" >/dev/null; then
    echo "Deployment succeeded: http://${HOST}/"
    exit 0
  fi
  sleep 2
done

echo "Deployment failed: http://${HOST}/api/health did not return HTTP 200." >&2
exit 1

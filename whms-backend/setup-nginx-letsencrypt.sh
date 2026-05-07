#!/usr/bin/env bash
set -euo pipefail

FRONTEND_DOMAIN="${FRONTEND_DOMAIN:-whms.erpublic.com}"
BACKEND_DOMAIN="${BACKEND_DOMAIN:-apiwhms.erpublic.com}"

FRONTEND_UPSTREAM_HOST="${FRONTEND_UPSTREAM_HOST:-127.0.0.1}"
FRONTEND_UPSTREAM_PORT="${FRONTEND_UPSTREAM_PORT:-3000}"

BACKEND_UPSTREAM_HOST="${BACKEND_UPSTREAM_HOST:-127.0.0.1}"
BACKEND_UPSTREAM_PORT="${BACKEND_UPSTREAM_PORT:-4000}"

LE_EMAIL="${LE_EMAIL:-admin@erpublic.com}"

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  cat <<'TXT'
Usage:
  sudo ./setup-nginx-letsencrypt.sh

Optional env overrides:
  FRONTEND_DOMAIN=whms.erpublic.com
  BACKEND_DOMAIN=apiwhms.erpublic.com
  FRONTEND_UPSTREAM_HOST=127.0.0.1
  FRONTEND_UPSTREAM_PORT=3000
  BACKEND_UPSTREAM_HOST=127.0.0.1
  BACKEND_UPSTREAM_PORT=4000
  LE_EMAIL=admin@erpublic.com
TXT
  exit 0
fi

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Harus dijalankan sebagai root (sudo)."
  exit 1
fi

if ! command -v apt-get >/dev/null 2>&1; then
  echo "Script ini untuk Ubuntu/Debian (butuh apt-get)."
  exit 1
fi

if ! command -v nginx >/dev/null 2>&1; then
  echo "Nginx belum terinstall. Install nginx dulu, lalu jalankan script ini lagi."
  exit 1
fi

if ! command -v certbot >/dev/null 2>&1; then
  apt-get update
  apt-get install -y certbot python3-certbot-nginx
fi

if command -v ufw >/dev/null 2>&1; then
  ufw allow 'Nginx Full' >/dev/null 2>&1 || true
fi

cat > /etc/nginx/conf.d/whms-connection-upgrade.conf <<'NG'
map $http_upgrade $connection_upgrade {
  default upgrade;
  '' close;
}
NG

cat > /etc/nginx/sites-available/whms-backend.conf <<NG
server {
  listen 80;
  listen [::]:80;
  server_name ${BACKEND_DOMAIN};

  client_max_body_size 50m;

  location / {
    proxy_pass http://${BACKEND_UPSTREAM_HOST}:${BACKEND_UPSTREAM_PORT};
    proxy_http_version 1.1;

    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;

    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
  }
}
NG

cat > /etc/nginx/sites-available/whms-frontend.conf <<NG
server {
  listen 80;
  listen [::]:80;
  server_name ${FRONTEND_DOMAIN};

  client_max_body_size 50m;

  location / {
    proxy_pass http://${FRONTEND_UPSTREAM_HOST}:${FRONTEND_UPSTREAM_PORT};
    proxy_http_version 1.1;

    proxy_set_header Host \$host;
    proxy_set_header X-Real-IP \$remote_addr;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto \$scheme;

    proxy_set_header Upgrade \$http_upgrade;
    proxy_set_header Connection \$connection_upgrade;

    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
  }
}
NG

ln -sf /etc/nginx/sites-available/whms-backend.conf /etc/nginx/sites-enabled/whms-backend.conf
ln -sf /etc/nginx/sites-available/whms-frontend.conf /etc/nginx/sites-enabled/whms-frontend.conf

if [[ -e /etc/nginx/sites-enabled/default ]]; then
  rm -f /etc/nginx/sites-enabled/default
fi

nginx -t
systemctl reload nginx

certbot --nginx \
  -m "${LE_EMAIL}" --agree-tos --no-eff-email \
  -d "${FRONTEND_DOMAIN}" -d "${BACKEND_DOMAIN}"

nginx -t
systemctl reload nginx

echo "OK:"
echo "- https://${FRONTEND_DOMAIN} -> http://${FRONTEND_UPSTREAM_HOST}:${FRONTEND_UPSTREAM_PORT}"
echo "- https://${BACKEND_DOMAIN}  -> http://${BACKEND_UPSTREAM_HOST}:${BACKEND_UPSTREAM_PORT}"

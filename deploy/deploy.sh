#!/usr/bin/env bash
set -euo pipefail

# Deploy script for ServiceBooking (run on server)
# Usage: sudo ./deploy.sh

APP_DIR=/var/www/servicebooking
REPO=https://github.com/your-repo/servicebooking.git
BRANCH=main

# Ensure dependencies
apt update
apt install -y git curl nginx certbot npm nodejs build-essential

# Clone or pull
if [ -d "$APP_DIR" ]; then
  cd "$APP_DIR"
  git fetch --all
  git reset --hard origin/$BRANCH
else
  git clone --branch $BRANCH $REPO $APP_DIR
  cd $APP_DIR
fi

# Copy .env (fill values before running)
if [ ! -f .env ]; then
  cp .env.example .env
  echo "Please edit .env with production values and rerun. Exiting."
  exit 1
fi

# Build
npm ci
npm run build

# Install pm2 (optional) and start
npm install -g pm2 || true
pm2 start dist/server/node-build.mjs --name servicebooking --update-env
pm2 save

# Nginx setup (assumes deploy/nginx.servicebooking.conf exists)
cp deploy/nginx.servicebooking.conf /etc/nginx/sites-available/servicebooking.conf
ln -sf /etc/nginx/sites-available/servicebooking.conf /etc/nginx/sites-enabled/servicebooking.conf
systemctl restart nginx

# Obtain SSL cert with certbot
certbot --nginx -d your-domain.com -d www.your-domain.com --non-interactive --agree-tos -m admin@your-domain.com || true

echo "Deployment complete."

#!/bin/sh
set -eu

# Создаёт /config.json для SPA из переменной окружения.
# Это нужно для Timeweb Cloud: веб-клиент (nginx) и бэкенд (консоль) обычно на разных доменах.
#
# Использование:
# - задайте API_BASE_URL=https://<домен-бэкенда> (без /api/v1 и без слэша в конце)
# - либо VITE_API_BASE_URL=... (поддержка на всякий случай)

BASE="${API_BASE_URL:-}"
if [ -z "$BASE" ]; then
  BASE="${VITE_API_BASE_URL:-}"
fi

if [ -z "$BASE" ]; then
  # Ничего не задано — оставляем как есть (app попробует относительные /api/v1/*)
  exit 0
fi

# Убираем слэш в конце
BASE="$(printf %s "$BASE" | sed 's:/*$::')"
# Если по ошибке передали полный /api/v1 — убираем, чтобы не получить /api/v1/api/v1
case "$BASE" in
  */api/v1) BASE="${BASE%/api/v1}" ;;
esac

CONFIG_PATH="/usr/share/nginx/html/config.json"

printf '{\n  "api_base_url": "%s"\n}\n' "$BASE" > "$CONFIG_PATH"

# Service Booking — веб-консоль (админ API)

Навык для [OpenClaw](https://openclaw.ai): управление студией «Другое место» через REST.

## Переменные окружения (workspace / `.env`)

Замените хост на свой (HTTPS в продакшене).

```bash
export SERVICE_BOOKING_ADMIN_URL="https://YOUR-HOST/admin/api"
export SERVICE_BOOKING_ADMIN_KEY="ваш_пароль_админки"
```

## Точка подключения (манифест)

Полный список эндпоинтов и примеры `curl`:

```bash
curl -sS -H "X-Admin-Key: $SERVICE_BOOKING_ADMIN_KEY" \
  "$SERVICE_BOOKING_ADMIN_URL/integration/openclaw" | jq .
```

Ответ JSON: `admin_api_base`, `admin_endpoints`, `curl_examples`, `connection`.

## Типовые действия

```bash
# Записи
curl -sS -H "X-Admin-Key: $SERVICE_BOOKING_ADMIN_KEY" \
  "$SERVICE_BOOKING_ADMIN_URL/bookings?sort=created&limit=10"

# Подтвердить запись
curl -sS -X PATCH \
  -H "X-Admin-Key: $SERVICE_BOOKING_ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"confirmed"}' \
  "$SERVICE_BOOKING_ADMIN_URL/bookings/BOOKING_UUID/status"

# Услуги и посты
curl -sS -H "X-Admin-Key: $SERVICE_BOOKING_ADMIN_KEY" "$SERVICE_BOOKING_ADMIN_URL/services"
curl -sS -H "X-Admin-Key: $SERVICE_BOOKING_ADMIN_KEY" "$SERVICE_BOOKING_ADMIN_URL/posts"
```

## Безопасность

- Не коммитьте `SERVICE_BOOKING_ADMIN_KEY`.
- Для OpenClaw храните ключ в защищённом workspace; при компрометации смените пароль админки и перевыпустите доступ.

## Клиентское API (iOS)

База: `https://YOUR-HOST/api/v1` — заголовок `X-API-Key` (ключ регистрации устройства). Публично без ключа: `GET /api/v1/invites/preview?code=`.

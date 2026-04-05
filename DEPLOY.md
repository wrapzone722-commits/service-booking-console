# Деплой веб-консоли

## Новый деплой (чтобы подтянуть изменения)

1. **Через GitHub Actions (рекомендуется)**  
   - Откройте репозиторий на GitHub → вкладка **Actions**.  
   - Выберите workflow **"Build Web Console"**.  
   - Нажмите **Run workflow** → **Run workflow** (ветка `main`).  
   - Дождитесь окончания сборки. Будет собран образ и отправлен в GitHub Container Registry.

2. **Образ после сборки**  
   - `ghcr.io/<владелец-репо>/service-booking-console:latest`  
   - `ghcr.io/<владелец-репо>/service-booking-console:<sha>`  

3. **Запуск на сервере с новым образом**  
   ```bash
   docker pull ghcr.io/<владелец-репо>/service-booking-console:latest
   docker stop service-booking-console  # если контейнер уже запущен
   docker rm service-booking-console
   docker run -d --name service-booking-console \
     -p 3000:3000 \
     -v service_booking_data:/data \
     -e DB_PATH=/data/service_booking.db \
     -e PORT=3000 \
     --restart unless-stopped \
     ghcr.io/<владелец-репо>/service-booking-console:latest
   ```

   Либо через `docker-compose` в папке `web-console`: обновите в `docker-compose.yml` образ на `ghcr.io/<владелец-репо>/service-booking-console:latest` и выполните:
   ```bash
   docker-compose pull && docker-compose up -d
   ```

## Синхронизация в репозиторий service-booking-console

При пуше в `main` (при изменениях в `web-console/`) workflow автоматически пушит код в репозиторий [service-booking-console](https://github.com/wrapzone722-commits/service-booking-console) в ветку **main** (с принудительным обновлением).

Чтобы синхронизация работала, в репозитории **ServiceBooking** добавьте секрет:
- **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
- Имя: `CONSOLE_PUSH_TOKEN`
- Значение: [Personal Access Token](https://github.com/settings/tokens) с правом **repo** для аккаунта, имеющего push в `wrapzone722-commits/service-booking-console`.

Если секрет не задан, job `sync-console` просто пропускает пуш (ошибки не будет).

## Деплой на Timeweb (и другие платформы)

- **Этот проект использует npm и `package-lock.json`, не pnpm.** Если в логах появляются ошибки про pnpm (browserslist, yaml, jiti и т.д.), значит платформа собирает проект как pnpm-репозиторий.
- **Рекомендация:** разворачивать готовый Docker-образ из GitHub Actions (GHCR), а не сборку из исходников через встроенный Node/pnpm:
  - В Timeweb выберите деплой из **Docker-образа** и укажите `ghcr.io/wrapzone722-commits/service-booking-console:latest`.
- **Если всё же собираете из исходников:**
  - Убедитесь, что в корне репозитория **нет** `pnpm-lock.yaml` (иначе платформа может выбрать pnpm). Должны быть только `package.json` и `package-lock.json`.
  - В настройках сборки укажите менеджер пакетов **npm** и команду установки: `npm ci --omit=dev` (аналог frozen lockfile, без dev-зависимостей).

В `Dockerfile` используется `npm ci --omit=dev` (без `--no-optional`: иначе не ставятся платформенные пакеты **sharp** под Alpine/musl).

## Локальная сборка

```bash
cd web-console
docker build -t service-booking-console:local .
docker run -p 3000:3000 -v service_booking_data:/data -e DB_PATH=/data/service_booking.db service-booking-console:local
```

Версия в service-booking-console обновляется при каждом пуше в `web-console/` из репозитория ServiceBooking.

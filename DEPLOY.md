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

## Локальная сборка

```bash
cd web-console
docker build -t service-booking-console:local .
docker run -p 3000:3000 -v service_booking_data:/data -e DB_PATH=/data/service_booking.db service-booking-console:local
```

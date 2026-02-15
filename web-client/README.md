# Веб-клиент «Запись на услугу»

Отдельное SPA на React — веб-версия клиентского приложения (по аналогии с iOS). Использует тот же бэкенд (API консоли), не смешивается с кодом консоли.

## Запуск

```bash
cd web-client
pnpm install
pnpm dev
```

Приложение откроется на `http://localhost:5174`. Запросы к API идут на `http://localhost:8080` через proxy (если консоль запущена там).

## Сборка

```bash
pnpm build
pnpm preview   # просмотр dist
```

Для продакшена задайте `VITE_API_BASE_URL` (полный URL API без слэша в конце).

## Docker (деплой в Timeweb Cloud и др.)

В корне есть `Dockerfile` и `nginx.conf` для сборки контейнера. Сборка: статика через Vite, раздача через nginx (порт 80).

```bash
docker build -t webclient .
docker run -p 80:80 webclient
```

В настройках платформы укажите тип приложения **Dockerfile**; путь проверки состояния (health check) при необходимости — `/` (код 200).

### URL бэкенда (избежать ошибки «Unexpected token '<'»)

Если в приложении появляется ошибка **«Unexpected token '<', "<!DOCTYPE "... is not valid JSON»**, запросы уходят на тот же хост, что и SPA, и сервер отдаёт HTML вместо JSON. Нужно указать полный URL бэкенда (консоли с API):

1. **Через config.json (без пересборки)**  
   Положите в корень сайта (рядом с index.html) файл **config.json**:
   ```json
   { "api_base_url": "https://ваш-бэкенд.example.com" }
   ```
   Пример есть в `public/config.json.example`. В Docker можно добавить файл в образ или монтировать volume.

2. **При сборке**  
   Задайте переменную окружения **VITE_API_BASE_URL** (без слэша в конце):
   ```bash
   VITE_API_BASE_URL=https://ваш-бэкенд.example.com npm run build
   ```
   Или в Docker: `docker build --build-arg VITE_API_BASE_URL=https://... .`

3. **Timeweb Cloud / Docker (без пересборки)**  
   В контейнере nginx есть скрипт, который **создаёт `/config.json` на старте** из переменной окружения **`API_BASE_URL`** (или `VITE_API_BASE_URL`).  
   Поэтому в Timeweb Cloud достаточно добавить переменную окружения приложения:
   - `API_BASE_URL=https://ваш-бэкенд.example.com`

## Структура (по образцу iOS)

- **Услуги** — список услуг, поиск, переход в детали и запись на услугу (дата, пост, слоты, комментарий).
- **Мои записи** — вкладки: предстоящие, прошедшие, отменённые; отмена (pending/confirmed); для завершённых — кнопки «Оценить» (1–5 звёзд + комментарий) и «Акт» (скачивание PDF).
- **Профиль** — просмотр и редактирование (имя, фамилия, email, Telegram, VK), выбор авто (фото из папок консоли), блок «Уведомления» (список, отметка прочитанным), выход.
- **Подключение** — если URL бэкенда ещё не задан, открывается экран `/connect` со **сканером QR-кода** (камера) и ручным вводом URL.
- **Telegram Login** — на `/connect` есть виджет **«Войти через Telegram»** (Telegram Login Widget). Требует, чтобы на бэкенде были заданы `TELEGRAM_BOT_TOKEN` и `TELEGRAM_BOT_USERNAME`, и домен приложения был разрешён в BotFather.

Авторизация: при первом заходе вызывается `POST /api/v1/clients/register` (device_id для веба генерируется и хранится в localStorage), в ответ приходит `api_key`. Он сохраняется и передаётся в заголовках `X-API-Key` и `Authorization: Bearer` во всех запросах.

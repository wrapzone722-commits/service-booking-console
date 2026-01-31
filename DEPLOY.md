# Деплой: Git → Timeweb Cloud (App Platform, Docker)

Проект подготовлен к деплою через Git-репозиторий в **Timeweb Cloud App Platform** с использованием **Dockerfile**.

## Что уже настроено

- **Dockerfile** — мультистейдж-сборка (Node 20 Alpine): сборка клиента и сервера, затем минимальный runtime-образ.
- **pnpm** — в образе используется pnpm (как в проекте).
- **Порт** — приложение слушает `PORT` (по умолчанию 3000). Платформа может задать свой порт через переменную окружения.
- **Health check** — эндпоинт `GET /health` возвращает `200 OK`; в образе настроен `HEALTHCHECK` для проверки живости контейнера.
- **.dockerignore** — в контекст сборки не попадают `node_modules`, `dist`, `.env`, лишние файлы (включая папку `server` в контексте не исключаем — она нужна для сборки).
- **.gitignore** — `.env` и `.env.*` не коммитятся; в репозиторий можно положить только `.env.example`.

## Шаги деплоя

### 1. Репозиторий в Git

```bash
git init
git add .
git commit -m "Prepare for deploy"
git remote add origin <URL вашего репозитория>
git push -u origin main
```

Убедитесь, что в репозитории **нет** файла `.env` (он в `.gitignore`).

### 2. Timeweb Cloud App Platform

1. В панели Timeweb Cloud откройте **App Platform** (или раздел деплоя приложений).
2. Создайте новое приложение, выберите источник **Git** и укажите ваш репозиторий и ветку (например, `main`).
3. Тип сборки: **Docker** (по Dockerfile).  
   Если платформа спрашивает путь к Dockerfile — оставьте `Dockerfile` в корне.
4. Порт: укажите переменную окружения **`PORT`** (часто платформа сама подставляет порт, например 8080 или 3000). Приложение читает `process.env.PORT`.
5. Добавьте переменные окружения из `.env.example` в настройках приложения (секреты не коммитить):
   - `NODE_ENV=production`
   - `JWT_SECRET` — обязательно задать свой секрет
   - `DATABASE_URL` — если используется БД
   - `YANDEX_CLIENT_ID`, `YANDEX_CLIENT_SECRET`, `YANDEX_REDIRECT_URI` — для OAuth
   - `OPENAI_API_KEY`, `API_BASE_URL`, SMTP, SMS и т.д. — по необходимости
6. Запустите сборку и деплой. Платформа соберёт образ по Dockerfile и запустит контейнер.

### 3. Проверка после деплоя

- Откройте URL приложения — должна открыться SPA.
- Проверьте API: `https://<ваш-домен>/api/ping`.
- Проверьте health: `https://<ваш-домен>/health` — ответ `{"status":"ok"}`.

## Локальная проверка Docker-образа

```bash
pnpm build
docker build -t servicebooking:local .
docker run -p 3000:3000 -e JWT_SECRET=test-secret servicebooking:local
```

В браузере: http://localhost:3000 и http://localhost:3000/health.

## Переменные окружения (кратко)

| Переменная           | Описание                    |
|----------------------|-----------------------------|
| `PORT`               | Порт сервера (по умолчанию 3000) |
| `NODE_ENV`           | Обычно `production`         |
| `JWT_SECRET`         | Секрет для JWT (обязательно) |
| `DATABASE_URL`       | URL PostgreSQL (если нужна БД) |
| `API_BASE_URL`       | Базовый URL API для фронта  |
| `YANDEX_*`           | OAuth Яндекса               |
| `OPENAI_API_KEY`     | Для ассистента              |

Полный список и пример — в `.env.example`.

## Troubleshooting

- **Сборка падает в Docker** — проверьте, что в репозитории есть папки `client/`, `server/`, `shared/` и файлы `vite.config.ts`, `vite.config.server.ts`.
- **502 / контейнер падает** — проверьте логи в панели; убедитесь, что заданы обязательные переменные (например, `JWT_SECRET`) и что приложение слушает `PORT`, который задаёт платформа.
- **Health check failed** — убедитесь, что платформа не блокирует внутренний порт и что эндпоинт `/health` доступен внутри контейнера.

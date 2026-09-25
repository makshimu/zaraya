# QR-меню с заказом со стола

ТЗ: гость сканирует QR на столе → меню в браузере → заказ / вызов официанта / счёт; персонал видит всё в админке в реальном времени.

## Статус этапов

- [x] **1. Скелет:** docker compose, БД, миграции, авторизация админки, CRUD залов и столов, генерация QR
- [ ] 2. Меню в админке
- [ ] 3. Гостевое меню, сессии стола
- [ ] 4. Корзина и заказ, realtime-лента
- [ ] 5. Вызовы, счёт, экран «Зал», закрытие стола
- [ ] 6. Превью, PDF с QR, Telegram, бэкапы, e2e

## Запуск

```bash
cp .env.example .env   # задайте JWT_SECRET, POSTGRES_PASSWORD, ADMIN_PASSWORD, DOMAIN
docker compose up -d --build
```

- Админка: `https://<DOMAIN>/admin/` (для `localhost` у Caddy свой локальный сертификат, браузер попросит подтвердить)
- API docs: `https://<DOMAIN>/api/docs`, healthcheck: `/api/health`
- Первый админ создаётся из `ADMIN_EMAIL` / `ADMIN_PASSWORD` при первом старте на пустой БД.
- Миграции Alembic применяются автоматически при старте `api`.

## Тесты

```bash
docker compose --profile test run --rm api-test
```

## Структура

```
backend/      FastAPI + SQLAlchemy 2 (async) + Alembic
  app/api/    роуты /api/admin/*
  app/models/ модели БД
  alembic/    миграции
  tests/      pytest (поднимает отдельную БД <name>_test)
frontend/
  admin/      React + Vite + TS + Tailwind + TanStack Query, i18n в src/i18n/locales
  Dockerfile  собирает фронт и отдаёт его через nginx
caddy/        Caddyfile: /api → api, остальное → web, HTTPS автоматически
```

## API этапа 1

| Метод | Путь | Роль |
|---|---|---|
| POST | `/api/admin/auth/login` | — |
| GET | `/api/admin/auth/me` | любой |
| GET | `/api/admin/settings` | любой |
| GET / POST | `/api/admin/halls` | чтение — любой, запись — admin |
| PUT / DELETE | `/api/admin/halls/{id}` | admin |
| GET / POST | `/api/admin/tables` | чтение — любой, запись — admin |
| PATCH / DELETE | `/api/admin/tables/{id}` | admin |
| POST | `/api/admin/tables/{id}/regenerate-token` | admin |
| GET | `/api/admin/tables/{id}/qr.png`, `qr.svg` | любой |

QR ведёт на `PUBLIC_BASE_URL/t/{token}`. Токен — 16 url-safe символов; после перевыпуска старый QR перестаёт работать.

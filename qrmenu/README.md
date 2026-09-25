# QR-меню с заказом со стола

ТЗ: гость сканирует QR на столе → меню в браузере → заказ / вызов официанта / счёт; персонал видит всё в админке в реальном времени.

## Статус этапов

- [x] **1. Скелет:** docker compose, БД, миграции, авторизация админки, CRUD залов и столов, генерация QR
- [x] **2. Меню в админке:** категории, блюда, варианты цен, группы модификаторов, фото (webp 400/1200), drag&drop, мультиязычность
- [x] **3. Гостевое меню:** скан QR → сессия стола (по умолчанию 3 ч), истечение сессии, экран блюда с вариантами и модификаторами; экран настроек в админке
- [ ] 4. Корзина и заказ, realtime-лента
- [ ] 5. Вызовы, счёт, экран «Зал», закрытие стола
- [ ] 6. Превью, PDF с QR, Telegram, бэкапы, e2e

## Запуск

```bash
cp .env.example .env   # задайте JWT_SECRET, POSTGRES_PASSWORD, ADMIN_PASSWORD, DOMAIN
docker compose up -d --build
```

- Гостевое меню: `https://<DOMAIN>/` (гость попадает туда по QR `https://<DOMAIN>/t/<token>`)
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
  guest/      мобильное меню гостя (React + Tailwind + TanStack Query, без тяжёлых библиотек), i18n в src/locales
  shared/     общий код: деньги, выбор перевода
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

### Этап 2 — меню

| Метод | Путь | Роль |
|---|---|---|
| GET | `/api/admin/menu` | любой — всё меню одним запросом |
| POST | `/api/admin/uploads/image` | admin — multipart `file`, ответ `{key, urls}` |
| POST / PUT / PATCH / DELETE | `/api/admin/categories[/{id}]` | admin |
| PUT | `/api/admin/categories/order` | admin — `{ids: [...]}` |
| POST / PUT / PATCH / DELETE | `/api/admin/items[/{id}]` | admin |
| PUT | `/api/admin/categories/{id}/items/order` | admin |
| POST / PUT / DELETE | `/api/admin/modifier-groups[/{id}]` | admin |
| PUT | `/api/admin/modifier-groups/order` | admin |

- Деньги — целые числа в минимальных единицах валюты (для VND это донги, для RUB — копейки).
- Мультиязычные поля — `{"ru": "...", "en": "..."}`; пустые переводы отбрасываются, хотя бы один обязателен.
- Цены блюда и модификаторы группы передаются целым списком: с `id` — обновить, без `id` — создать, отсутствующие — удалить.
- Фото: ресайз в webp 400px и 1200px (Pillow), лежат в volume `media`, Caddy отдаёт их по `/media/*`.
- Расписание категории: `available_from`/`available_to` в часовом поясе ресторана (`restaurant_settings.timezone`); применяется в гостевом меню (этап 3).

### Этап 3 — гость

| Метод | Путь | Что делает |
|---|---|---|
| GET | `/t/{token}` | ссылка из QR: создаёт сессию стола, ставит httpOnly-cookie `qr_session`, редирект на `/`. Неверный QR → `/?error=invalid_qr`, выключенный стол → `/?error=table_inactive` |
| GET | `/api/guest/session` | `{status, table, expires_at}`; `status`: `active` / `expired` / `closed` / `table_inactive` / `null` (нет cookie) |
| GET | `/api/guest/menu` | меню как его видит гость сейчас: только включённые категории и блюда, с учётом расписания; «нет в наличии» приходит флагом |
| GET / PUT | `/api/admin/settings` | настройки ресторана (PUT — admin) |

- Каждый скан — новая сессия (несколько телефонов за столом = несколько сессий). Срок жизни — `session_ttl_minutes` из настроек.
- После истечения меню смотреть можно; заказ, вызов официанта и счёт (этапы 4–5) будут закрыты зависимостью `ActiveSession`.
- Cookie `Secure`; для локальной разработки по http без Caddy задайте `GUEST_COOKIE_SECURE=false`.
- Пока нет realtime (этап 4), гостевое меню обновляется раз в 30 с — выключенное в админке блюдо пропадает без перезагрузки.

### QR

QR ведёт на `PUBLIC_BASE_URL/t/{token}`. Токен — 16 url-safe символов; после перевыпуска старый QR перестаёт работать.

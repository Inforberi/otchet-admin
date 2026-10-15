# Отчетник

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Prisma 6, PostgreSQL 16.

Отчеты состоят из текстов, фото и вложений, задач, секций и разделителей.
Редактор поддерживает форматирование, drag & drop, локальные черновики,
автосохранение и отдельную публикацию снимка. PDF генерируется через Playwright.
Доступ определяется пользователем, ролью и правами на группы.

## API

[Полная инструкция, типы и примеры запросов](docs/API.md).

Через API можно создавать отчеты, загружать файлы, добавлять отдельные блоки
или пакеты, передавать настройки фото и публиковать готовый отчет.
Типы запросов и JSON-ответов: `lib/report-api-types.ts`.

## Локальный запуск

Нужны Node.js 22, pnpm 10 и Docker Compose. Создайте `.env` по `.env.template`
и заполните настройки подключения к БД, `JWT_SECRET` и `SETUP_CODE`.

```bash
pnpm install --frozen-lockfile
make dev
```

`make dev` поднимает PostgreSQL, генерирует Prisma Client, применяет существующие
миграции через `migrate deploy` и запускает Next.js на `http://localhost:3000`.
Первый администратор создается через `/setup` с кодом `SETUP_CODE`.
Далее вход выполняется по email и паролю. Пользователи и роли хранятся в БД.

## Проверки

```bash
pnpm typecheck
pnpm exec tsx --test lib/*.test.ts
pnpm build
```

## Docker и сохранность данных

```bash
make backup
make prod
```

Compose публикует приложение на `http://localhost:3002`.
PostgreSQL хранится в volume `postgres_data`, файлы — в каталоге `./uploads`,
смонтированном в `/app/uploads`. Для переноса нужны оба хранилища.

`make backup` создает резервные копии БД и uploads. Обновления API в этой версии
не меняют Prisma-схему и не требуют новых миграций.
Команды `make clean` и `docker compose down -v` удаляют volumes;
не используйте их для обычного обновления существующей установки.

## Основные переменные окружения

| Переменная | Назначение |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string; внутри Compose хост БД — `postgres` |
| `JWT_SECRET` | Секрет подписи сессий |
| `SETUP_CODE` | Код первичного создания администратора |
| `COOKIE_SECURE` | `true` для HTTPS; `false` для локального HTTP |
| `UPLOAD_DIR` | Каталог файлов, по умолчанию `./uploads` |
| `MAX_UPLOAD_SIZE` | Лимит файла в байтах, по умолчанию 10485760 |
| `PDF_INTERNAL_BASE_URL` | Внутренний адрес приложения для PDF |

## Структура

- `app/api` — API приложения.
- `components/pages/report-edit-page.tsx` — редактор отчета.
- `components/editor/rich-text-editor.tsx` — ввод и форматирование текста.
- `hooks/use-report-draft-sync.ts` — черновики и синхронизация.
- `lib/report-api.ts` — схемы валидации запросов добавления блоков и отчетов.
- `lib/report-api-types.ts` — типы для интеграций.
- `prisma` — схема и миграции БД.
- `docs/API.md` — сценарии заполнения через API.

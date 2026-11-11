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
# или
pnpm dev
```

Приложение будет доступно по адресу: http://localhost:3000

При первом запуске вы будете перенаправлены на страницу входа. Используйте логин и пароль из переменных окружения `ADMIN_USERNAME` и `ADMIN_PASSWORD` (по умолчанию: `admin` / `admin123`).

### Docker (production)

```bash
# Production запуск: build + postgres + migrate + app
make prod

# Посмотреть логи
make logs

# Остановить
make down

# Полный сброс
make reset
```

## 📁 Структура проекта

```
admin-panel/
├── app/
│   ├── api/                    # API routes
│   │   ├── reports/            # CRUD отчетов
│   │   ├── uploads/            # Загрузка файлов
│   │   └── static/             # Отдача статики
│   ├── reports/                # Страницы отчетов
│   │   ├── [id]/               # Просмотр/редактирование
│   │   └── new/                # Создание отчета
│   └── ...
├── components/
│   ├── admin/                  # Компоненты админки
│   ├── report/                 # Компоненты отчетов
│   ├── ui/                     # UI библиотека
│   └── markdown-renderer.tsx   # Markdown рендер
├── lib/
│   ├── prisma.ts               # Prisma клиент
│   ├── types.ts                # Старые типы
│   ├── db-types.ts             # Новые типы для БД
│   └── storage.ts              # Утилиты (legacy)
├── prisma/
│   ├── schema.prisma           # Схема БД
│   └── migrations/             # Миграции
├── uploads/                    # Загруженные файлы
├── docker-compose.yml          # Docker конфигурация
├── Dockerfile                  # Docker образ
├── Makefile                    # Команды для управления
└── README.md
```

## 🎨 Основные функции

### Создание отчета

1. Перейти на главную страницу `/reports`
2. Нажать "Создать отчет"
3. Заполнить метаданные (название, клиент, дата)
4. Перейти в редактор

### Редактор блоков

-   **Левая панель** - предпросмотр отчета
-   **Правая панель** - список блоков с drag & drop
-   Добавление блоков: текст или фото
-   Drag & drop для изменения порядка
-   Клик на блок для редактирования

### Типы блоков

#### Текстовый блок

-   Поддержка Markdown (заголовки, списки, ссылки, код, цитаты)
-   Настройка размера шрифта
-   Форматирование (жирный, курсив)

#### Фото-блок

-   Загрузка нескольких изображений
-   Layout: full-width, sidebar, two-column
-   Подписи для каждого изображения (caption)
-   Alt текст для доступности
-   Настройка размеров и отступов

### Экспорт в PDF

-   Серверная генерация через Playwright
-   Корректная верстка на всех страницах
-   Поддержка Markdown в PDF
-   Изображения встраиваются корректно
-   A4 формат с полями

## 🗃️ База данных

### Модели

**reports** - отчеты

-   id, title, subtitle, client, date, status
-   created_at, updated_at

**report_blocks** - блоки отчетов

-   id, report_id, type, position, data (jsonb)
-   created_at, updated_at

**uploads** - метаданные файлов

-   id, report_id, filename, path, mime_type, size
-   created_at

### Миграции

```bash
# Создать новую миграцию
make migrate-create

# Применить миграции (dev)
make migrate-dev

# Применить миграции (production)
make migrate

# Сбросить БД
make migrate-reset
```

## 🔧 Полезные команды

```bash
# Разработка
make dev              # Запуск dev сервера
make install          # Установка зависимостей
make prisma-studio    # Открыть Prisma Studio

# Docker
make up               # Поднять все сервисы
make down             # Остановить все
make logs             # Показать логи
make build            # Пересобрать образы
make clean            # Очистить Docker

# База данных
make db-up            # Только БД
make db-down          # Остановить БД
make migrate          # Применить миграции
make migrate-reset    # Сброс БД
make prisma-generate  # Сгенерировать Prisma Client

# Полезное
make help             # Показать все команды
```

## 🌐 API Endpoints

### Отчеты

-   `GET /api/reports` - список отчетов (с поиском)
-   `POST /api/reports` - создать отчет
-   `GET /api/reports/[id]` - получить отчет
-   `PATCH /api/reports/[id]` - обновить отчет
-   `DELETE /api/reports/[id]` - удалить отчет
-   `GET /api/reports/[id]/pdf` - скачать PDF

### Блоки

-   `GET /api/reports/[id]/blocks` - список блоков
-   `POST /api/reports/[id]/blocks` - создать блок
-   `PATCH /api/reports/[id]/blocks/[blockId]` - обновить блок
-   `DELETE /api/reports/[id]/blocks/[blockId]` - удалить блок
-   `POST /api/reports/[id]/blocks/reorder` - изменить порядок

### Загрузка файлов

-   `POST /api/uploads` - загрузить файл
-   `GET /api/uploads?reportId=[id]` - список загрузок
-   `DELETE /api/uploads/[id]` - удалить файл

### Авторизация

-   `POST /api/auth/login` - войти в систему
-   `POST /api/auth/logout` - выйти из системы

**Все API endpoints (кроме `/api/auth/login`) требуют авторизации.**

## 🔐 Переменные окружения

Создайте `.env` файл:

```env
DATABASE_URL="postgresql://admin:password@localhost:5432/admin_panel?schema=public"
PORT=3000
UPLOAD_DIR="./uploads"
MAX_UPLOAD_SIZE=104857600

# Авторизация
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your-secure-password-here"
VIEWER_USERNAME="viewer"
VIEWER_PASSWORD="your-viewer-password-here"
SESSION_SECRET="your-random-secret-key-here"
```

Лимит одного файла — 100 МиБ (104857600 байт) для фото-блоков, вложений задач
и отчетов о выполнении задач: все используют `/api/uploads`. Лимит тела запроса
в `next.config.mjs` — 110 МиБ с учетом multipart/form-data.
После изменения `.env` перезапустите приложение; для Docker пересоберите
образ и пересоздайте контейнер приложения. Если перед приложением настроен
внешний reverse proxy, его лимит тела запроса также должен быть не ниже 110 МиБ.

### Настройка авторизации

**Роли пользователей:**

1. **Администратор** (`admin`) - полный доступ:

    - Просмотр всех отчетов
    - Создание, редактирование и удаление отчетов
    - Управление блоками и загрузка файлов

2. **Просмотр** (`viewer`) - только чтение:
    - Просмотр всех отчетов
    - Без возможности редактирования

**Переменные окружения:**

-   `ADMIN_USERNAME` - логин администратора (по умолчанию: `admin`)
-   `ADMIN_PASSWORD` - пароль администратора (обязательно измените в production!)
-   `VIEWER_USERNAME` - логин для просмотра (по умолчанию: `viewer`)
-   `VIEWER_PASSWORD` - пароль для просмотра (обязательно измените в production!)
-   `SESSION_SECRET` - секретный ключ для подписи сессий (обязательно измените в production!)

**По умолчанию (если не указано):**

-   `ADMIN_USERNAME` = `admin`
-   `ADMIN_PASSWORD` = `admin123`
-   `VIEWER_USERNAME` = `viewer`
-   `VIEWER_PASSWORD` = `viewer123`
-   `SESSION_SECRET` = `change-me-in-production`

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

# Админ-панель для сборки отчетов

Production-ready система для создания и управления отчетами с блоками контента.

## 🚀 Возможности

-   ✅ **PostgreSQL** - основная база данных
-   ✅ **Prisma ORM** - типобезопасная работа с БД
-   ✅ **Авторизация** - защита доступа с сессиями
-   ✅ **Список отчетов** - создание, редактирование, удаление, поиск
-   ✅ **Редактор блоков** - удобный интерфейс с drag & drop
-   ✅ **Markdown** - поддержка разметки в текстовых блоках
-   ✅ **Загрузка изображений** - хранение на сервере (не в БД)
-   ✅ **Расширенные фото-блоки** - 2 фото рядом, подписи, настройки layout
-   ✅ **PDF экспорт** - серверная генерация через Playwright
-   ✅ **Docker** - простой запуск одной командой

## 📋 Стек технологий

-   **Frontend**: Next.js 16, React 19, TypeScript
-   **Styling**: Tailwind CSS 4
-   **UI**: Radix UI, lucide-react
-   **Database**: PostgreSQL 16, Prisma 7
-   **PDF**: Playwright (headless Chromium)
-   **DnD**: @dnd-kit
-   **Markdown**: react-markdown, remark-gfm

## 🛠️ Установка и запуск

### Предварительные требования

-   Node.js 20+
-   pnpm 10+
-   Docker & Docker Compose

### Быстрый старт

```bash
# 1. Клонировать репозиторий
git clone <repo-url>
cd admin-panel

# 2. Установить зависимости
make install
# или
pnpm install

# 3. Поднять БД
make db-up

# 4. Применить миграции
make migrate-dev

# 5. Запустить приложение в dev режиме
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
MAX_UPLOAD_SIZE=10485760

# Авторизация
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="your-secure-password-here"
VIEWER_USERNAME="viewer"
VIEWER_PASSWORD="your-viewer-password-here"
SESSION_SECRET="your-random-secret-key-here"
```

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

**⚠️ ВАЖНО**: Обязательно измените эти значения перед деплоем в production!

## 🐛 Troubleshooting

### Проблема: Docker не запускается

```bash
# Проверить статус Docker
docker ps

# Запустить Docker Desktop (macOS)
open -a Docker
```

### Проблема: Ошибка подключения к БД

```bash
# Проверить что БД запущена
make logs-db

# Пересоздать контейнер
make reset
```

### Проблема: Ошибка миграций

```bash
# Сбросить БД и применить миграции заново
make migrate-reset
```

### Проблема: Playwright не работает

```bash
# Установить браузеры Playwright
pnpm exec playwright install chromium
```

## 📝 Миграция со старой версии

Старая версия использовала localStorage. Для миграции:

1. Экспортируйте данные из localStorage (если нужно)
2. Создайте новый отчет через UI
3. Добавьте блоки вручную

Старые файлы (`lib/storage.ts`, старые страницы) оставлены для reference, но не используются.

## 🚀 Production Deployment

1. Настройте `.env` с production значениями
2. Запустите: `make prod`
4. Проверьте логи: `make logs`

### Чеклист перед деплоем

-   ✅ БД настроена и доступна
-   ✅ Миграции применены
-   ✅ Переменные окружения корректны
-   ✅ UPLOAD_DIR существует и доступен
-   ✅ Playwright установлен в Docker образе

## 📄 Лицензия

MIT

## 👨‍💻 Автор

Разработано как production-ready админ-панель для сборки отчетов.

# otchet-admin

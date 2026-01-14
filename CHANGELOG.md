# Changelog

## [2.0.0] - 2026-01-14

### 🎉 Major Refactoring - Production Ready

Полная модернизация проекта с переходом на production-качество.

### ✨ Добавлено

#### Backend & Database
- ✅ **PostgreSQL** как основная БД (вместо localStorage)
- ✅ **Prisma ORM** для типобезопасной работы с БД
- ✅ Миграции БД (версионирование схемы)
- ✅ API endpoints для CRUD операций (`/api/reports`, `/api/uploads`)
- ✅ Загрузка файлов на сервер (не в БД)
- ✅ Валидация типов файлов и размеров
- ✅ Безопасные имена файлов

#### Frontend & UX
- ✅ **Список отчетов** с созданием/удалением/поиском (`/reports`)
- ✅ **Новый редактор** с fixed панелью справа
- ✅ Live preview отчета в редакторе
- ✅ **Drag & Drop** для изменения порядка блоков (@dnd-kit)
- ✅ Автосохранение изменений в БД
- ✅ Улучшенная навигация между страницами

#### Блоки контента
- ✅ **Markdown поддержка** в текстовых блоках (react-markdown)
  - Заголовки H1-H6
  - Списки (упорядоченные и неупорядоченные)
  - Код (inline и блоки)
  - Цитаты
  - Ссылки
  - Жирный/курсив
- ✅ **Расширенные фото-блоки**:
  - Layout: full-width, sidebar, **two-column** (2 фото рядом)
  - Подписи для каждого изображения (caption)
  - Alt текст для доступности
  - Настройка отступов (spacing)
  - Кастомная ширина изображений

#### PDF Export
- ✅ **Серверная генерация PDF** через Playwright (headless Chromium)
- ✅ Корректная верстка A4 с полями
- ✅ Поддержка Markdown в PDF
- ✅ Изображения встраиваются правильно
- ✅ Многостраничность с переносами
- ✅ Стабильная работа в разных браузерах
- ❌ **Удалена** печать через window.print()

#### DevOps & Infrastructure
- ✅ **Docker Compose** для запуска (postgres + app)
- ✅ **Makefile** с удобными командами
- ✅ **Dockerfile** для production
- ✅ Volumes для БД и uploads
- ✅ Health checks для сервисов
- ✅ Seed скрипт для тестовых данных
- ✅ .dockerignore и обновленный .gitignore

#### Документация
- ✅ **README.md** - полная документация проекта
- ✅ **QUICKSTART.md** - быстрый старт за 2 минуты
- ✅ **MIGRATION.md** - гайд по миграции с localStorage
- ✅ **DEPLOYMENT.md** - production deployment guide
- ✅ **CHANGELOG.md** - история изменений

### 🔄 Изменено

#### Архитектура
- Роутинг: `/` → `/reports`, `/admin` → `/reports/[id]/edit`
- Типы данных: `lib/types.ts` → `lib/db-types.ts` (расширенные)
- Хранилище: localStorage → PostgreSQL + файловая система
- Изображения: base64 DataURL → server files with metadata

#### UI/UX
- Редактор вынесен на фиксированную панель (не отдельная страница)
- Preview отчета в реальном времени
- Drag & Drop вместо кнопок "вверх/вниз"
- Улучшенные карточки блоков

### 🗑️ Удалено
- ❌ localStorage как источник истины
- ❌ window.print() для PDF
- ❌ Base64 хранение изображений
- ❌ Старые страницы `/admin` и `/report`

### 📦 Новые зависимости

```json
{
  "dependencies": {
    "@prisma/client": "^7.2.0",
    "prisma": "^7.2.0",
    "@dnd-kit/core": "^6.3.1",
    "@dnd-kit/sortable": "^10.0.0",
    "@dnd-kit/utilities": "^3.2.2",
    "react-markdown": "^10.1.0",
    "remark-gfm": "^4.0.1",
    "rehype-raw": "^7.0.0",
    "rehype-sanitize": "^6.0.0",
    "playwright": "^1.57.0",
    "dotenv": "^17.2.3"
  },
  "devDependencies": {
    "tsx": "^4.21.0"
  }
}
```

### 🔧 Конфигурация

#### Новые файлы
- `prisma/schema.prisma` - схема БД
- `prisma/migrations/` - миграции
- `prisma/seed.ts` - seed скрипт
- `docker-compose.yml` - Docker конфигурация
- `Dockerfile` - production образ
- `Makefile` - команды управления
- `.env.template` - пример переменных окружения

#### Обновленные файлы
- `next.config.mjs` - добавлен `output: 'standalone'` и rewrites
- `package.json` - новые скрипты
- `.gitignore` - исключены uploads, .env, Prisma generated

### 🐛 Исправлено
- Некорректная генерация PDF (window.print)
- Проблемы с большими изображениями в base64
- Невозможность создания нескольких отчетов
- Ломающаяся верстка при печати
- Потеря данных при очистке localStorage

### 🚀 Производительность
- Изображения грузятся по требованию (не в bundle)
- БД индексы для быстрых запросов
- Кеширование статики (max-age: 1 year)
- Standalone build Next.js (меньше размер)

### 📊 Статистика

**Строк кода добавлено**: ~3500+  
**Новых файлов**: 30+  
**API endpoints**: 12  
**Моделей БД**: 3 (reports, report_blocks, uploads)

### ⚠️ Breaking Changes

**Миграция с версии 1.x обязательна!**

1. localStorage больше не используется
2. Старые URL (`/admin`, `/report`) не работают
3. Формат данных блоков изменен
4. Требуется PostgreSQL

См. [MIGRATION.md](MIGRATION.md) для деталей.

### 🔒 Безопасность

- Валидация загружаемых файлов (тип, размер)
- Безопасные имена файлов (предотвращение path traversal)
- Санитизация Markdown (rehype-sanitize)
- Prepared statements через Prisma (SQL injection protection)
- HTTPS ready (nginx конфигурация в DEPLOYMENT.md)

### 🎯 Готовность к Production

- [x] PostgreSQL как БД
- [x] Миграции с версионированием
- [x] Docker для простого деплоя
- [x] PDF экспорт стабилен
- [x] Обработка ошибок
- [x] Валидация данных
- [x] Документация
- [x] Seed данные для тестирования
- [x] Makefile для управления

---

## [1.0.0] - 2025

### Начальная версия

- localStorage для хранения
- Простой редактор на отдельной странице
- Base64 изображения
- Печать через window.print()
- Простой текст (без Markdown)
- Один draft отчет

---

## Semantic Versioning

Проект следует [Semantic Versioning](https://semver.org/):
- MAJOR (2.x.x) - breaking changes
- MINOR (x.1.x) - новый функционал (backwards compatible)
- PATCH (x.x.1) - багфиксы

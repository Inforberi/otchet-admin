# Миграция с localStorage на PostgreSQL

## Что изменилось

### Старая версия
- ❌ localStorage как единственное хранилище
- ❌ Изображения в base64
- ❌ Только один draft отчет
- ❌ Печать вместо PDF
- ❌ Простой текст (без Markdown)
- ❌ Редактор на отдельной странице

### Новая версия
- ✅ PostgreSQL база данных
- ✅ Изображения на сервере
- ✅ Множество отчетов
- ✅ Серверный PDF через Playwright
- ✅ Markdown в текстовых блоках
- ✅ Удобный редактор с preview

## Изменения в архитектуре

### Роутинг

**Было:**
- `/` - главная
- `/admin` - редактор
- `/report` - просмотр

**Стало:**
- `/` - редирект на `/reports`
- `/reports` - список отчетов
- `/reports/new` - создание отчета
- `/reports/[id]` - просмотр отчета
- `/reports/[id]/edit` - редактор отчета

### Типы данных

**Было (`lib/types.ts`):**
```typescript
interface ScreenshotBlock {
  images: string[] // base64
}
```

**Стало (`lib/db-types.ts`):**
```typescript
interface ImageData {
  url: string // путь к файлу
  caption?: string
  alt?: string
}

interface ScreenshotBlockData {
  images: ImageData[]
  layout?: "full-width" | "sidebar" | "two-column"
  spacing?: "small" | "medium" | "large"
}
```

### API

Добавлены новые endpoints:
- `/api/reports` - CRUD отчетов
- `/api/reports/[id]/blocks` - CRUD блоков
- `/api/reports/[id]/pdf` - генерация PDF
- `/api/uploads` - загрузка файлов

## Миграция данных

### Если нужно сохранить старые данные из localStorage:

1. **Экспорт из браузера**
```javascript
// Откройте консоль браузера (F12)
const data = localStorage.getItem('report_draft')
console.log(data)
// Скопируйте вывод
```

2. **Создайте новый отчет** через UI (`/reports/new`)

3. **Добавьте блоки вручную** через редактор

### Конвертация изображений

Старые изображения (base64) нужно загрузить через API:

```typescript
// Псевдокод
const base64Images = oldBlock.images
for (const base64 of base64Images) {
  const blob = base64ToBlob(base64)
  const formData = new FormData()
  formData.append('file', blob, 'image.png')
  formData.append('reportId', newReportId)
  
  await fetch('/api/uploads', {
    method: 'POST',
    body: formData
  })
}
```

## Удаление старого кода

Следующие файлы оставлены для справки, но не используются:
- `lib/storage.ts` - утилиты localStorage
- `lib/types.ts` - старые типы (частично)
- `app/admin/page.tsx` - старый редактор
- `app/report/page.tsx` - старый просмотр

Вы можете их удалить:
```bash
rm app/admin/page.tsx
rm app/report/page.tsx
# lib/storage.ts и lib/types.ts можно оставить для reference
```

## Проверка после миграции

1. Создайте тестовый отчет
2. Добавьте текстовый блок с Markdown
3. Добавьте фото-блок с 2 изображениями
4. Сохраните отчет
5. Экспортируйте в PDF
6. Проверьте что PDF корректный

## Rollback

Если нужно вернуться к старой версии:
```bash
git checkout HEAD~10  # или нужный коммит
```

Данные из БД останутся, localStorage работать не будет.

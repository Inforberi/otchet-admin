import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("🌱 Начинаю заполнение БД тестовыми данными...")

  // Находим или создаем группу по умолчанию
  let defaultGroup = await prisma.reportGroup.findUnique({
    where: { name: "Отчеты по сайту" },
  });

  if (!defaultGroup) {
    defaultGroup = await prisma.reportGroup.create({
      data: {
        name: "Отчеты по сайту",
        slug: "otchety-po-sajtu",
        description: "Группа по умолчанию",
      },
    });
  }

  // Создаем тестовый отчет
  const report = await prisma.report.create({
    data: {
      title: "Анализ производительности веб-сайта",
      slug: "analiz-proizvoditelnosti-veb-sajta",
      subtitle: "Результаты аудита и рекомендации по оптимизации",
      client: "ООО «Пример»",
      date: "2026-01-14",
      status: "draft",
      groupId: defaultGroup.id,
      blocks: {
        create: [
          {
            type: "text",
            position: 0,
            data: {
              title: "Введение",
              content: `# Цель аудита

Провести комплексный анализ производительности веб-сайта и выявить основные проблемы, влияющие на скорость загрузки и пользовательский опыт.

## Методология

- Анализ с помощью **PageSpeed Insights**
- Тестирование на реальных устройствах
- Мониторинг Core Web Vitals

## Основные метрики

1. **LCP** (Largest Contentful Paint) - время загрузки основного контента
2. **FID** (First Input Delay) - время до первого взаимодействия
3. **CLS** (Cumulative Layout Shift) - стабильность макета`,
              fontSize: "medium",
            },
          },
          {
            type: "text",
            position: 1,
            data: {
              title: "Результаты анализа",
              content: `## Текущие показатели

- **Performance Score**: 65/100 ⚠️
- **LCP**: 3.8s (нужно < 2.5s)
- **FID**: 120ms (нужно < 100ms)
- **CLS**: 0.15 (нужно < 0.1)

### Выявленные проблемы

1. Неоптимизированные изображения (суммарно ~5MB)
2. Отсутствие lazy loading
3. Блокирующий JavaScript в \`<head>\`
4. Не настроено кеширование статики
5. Отсутствует сжатие gzip/brotli

> **Примечание**: Эти проблемы критически влияют на SEO и конверсию.`,
              fontSize: "medium",
            },
          },
          {
            type: "text",
            position: 2,
            data: {
              title: "Рекомендации",
              content: `## План оптимизации

### Приоритет 1 (критично)

- [ ] Оптимизировать изображения (WebP, сжатие)
- [ ] Внедрить lazy loading для изображений
- [ ] Настроить кеширование браузера

### Приоритет 2 (важно)

- [ ] Перенести скрипты в \`<footer>\` или добавить \`defer\`
- [ ] Минифицировать CSS и JavaScript
- [ ] Включить Brotli сжатие на сервере

### Приоритет 3 (желательно)

- [ ] Настроить CDN для статики
- [ ] Использовать HTTP/2 или HTTP/3
- [ ] Реализовать code splitting

## Ожидаемый результат

После внедрения рекомендаций:
- Performance Score: **85-95/100** ✅
- LCP: **< 2.0s** ✅
- FID: **< 50ms** ✅
- CLS: **< 0.05** ✅`,
              fontSize: "medium",
            },
          },
          {
            type: "text",
            position: 3,
            data: {
              title: "Заключение",
              content: `Выявленные проблемы производительности имеют **критическое влияние** на пользовательский опыт и SEO.

Рекомендуется начать оптимизацию с приоритетных задач и провести повторный аудит через 2 недели.

*Контакты для вопросов: support@example.com*`,
              fontSize: "medium",
            },
          },
        ],
      },
    },
  })

  console.log(`✅ Создан отчет: "${report.title}" (ID: ${report.id})`)

  // Создаем второй пример отчета
  const report2 = await prisma.report.create({
    data: {
      title: "Краткий отчет по безопасности",
      slug: "kratkij-otchet-po-bezopasnosti",
      subtitle: "Security audit results",
      client: "Тестовый клиент",
      date: "2026-01-10",
      status: "published",
      groupId: defaultGroup.id,
      blocks: {
        create: [
          {
            type: "text",
            position: 0,
            data: {
              title: "Обнаруженные уязвимости",
              content: `## Критические проблемы

1. **SQL Injection** в форме поиска
2. Отсутствует **CSP** (Content Security Policy)
3. Устаревшие зависимости с известными CVE

## Рекомендации

- Использовать prepared statements
- Настроить CSP заголовки
- Обновить зависимости: \`npm audit fix\``,
              fontSize: "medium",
            },
          },
        ],
      },
    },
  })

  console.log(`✅ Создан отчет: "${report2.title}" (ID: ${report2.id})`)

  console.log("\n🎉 Заполнение БД завершено!")
  console.log(`\nСоздано отчетов: 2`)
  console.log(`Создано блоков: ${await prisma.reportBlock.count()}`)
}

main()
  .catch((e) => {
    console.error("❌ Ошибка при заполнении БД:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

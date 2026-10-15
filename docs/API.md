# Заполнение отчетов через API

API приложения Next.js, тот же адрес, что у интерфейса. Локально обычно
`http://localhost:3000`, Docker Compose публикует `http://localhost:3002`.
В production используйте адрес вашего сервера и HTTPS.

## Существующие данные и параллельные изменения

Изменения API не требуют миграций БД. Старый одиночный формат добавления блока
и поля `upload`/`url` в ответе загрузки сохранены.

`POST /api/reports/{id}/blocks` **добавляет** блоки в конец, не удаляет и не
заменяет существующие. Пакет из 1–100 блоков сохраняется одной транзакцией.
`expectedReportVersion` обязателен; при конфликте возвращается `409 VERSION_CONFLICT`
без добавления блоков. Получите отчет заново и проверьте изменения перед повтором.
Версия увеличивается на 1 за пакет. Загрузка файла сама по себе версию не меняет.

`PATCH /api/reports/{id}/draft` используется редактором для **полной замены**
снимка блоков. Не используйте его для добавления фото в существующий отчет:
пропущенные в снимке блоки удаляются.

Опубликованный снимок обновляется только при публикации через `/publish`.
Проверяйте актуальное содержимое перед публикацией существующего отчета:
публикуется весь текущий черновик, включая правки других редакторов.
Сохраните БД и каталог uploads штатной командой `make backup` перед развертыванием.
Не используйте команды reset, `make clean` или `docker compose down -v` для обновления.

## Авторизация

Нужен активный пользователь с `canEditContent=true` и доступом к группе.
Авторизация по email и паролю возвращает cookie `admin_session`.
Отдельный API-ключ или Bearer-токен этим API не выдаётся.
Храните cookie как секрет. В браузере того же сайта cookie отправляется автоматически;
в скрипте используйте cookie jar.

```bash
export REPORT_API_URL='http://localhost:3000'
# Заполните email/password в локальном файле login.json, не коммитьте его:
# {"email":"editor@example.com","password":"ваш пароль"}
curl --fail-with-body -sS -c report-cookies.txt \
  -H 'Content-Type: application/json' \
  --data-binary @login.json "$REPORT_API_URL/api/auth/login"
```

При `403 PASSWORD_CHANGE_REQUIRED` сначала смените временный пароль через интерфейс.

## Заполнение любого отчета, уже созданного через интерфейс

Да: отчет можно создать вручную в интерфейсе, а затем добавлять в **него же**
текст, фото, задачи, секции и разделители через API. Создавать второй отчет не нужно.
Все запросы записи направляются по `report.id`, поэтому название и вложенность
групп не мешают заполнению.

Сначала сохраните изменения в открытом редакторе и дождитесь завершения сохранения.
Для пакетного формата ниже сервер должен быть обновлен до версии с поддержкой
`blocks: [...]`, описанной в этом документе. Само изменение локального кода
не обновляет уже работающий production-сервер.

### 1. Получить ID из ссылки на отчет

Ссылка интерфейса имеет вид:

```text
http://SERVER:PORT/gruppa/podgruppa/reports/moy-otchet/edit
```

Соответствующий запрос чтения по пути:

```text
GET http://SERVER:PORT/api/groups/by-path/gruppa/podgruppa/reports/moy-otchet
```

То есть после адреса сервера добавьте `/api/groups/by-path`, сохраните весь путь
групп и `reports/{slug}`, уберите конечный `/edit`. Для ссылки просмотра
убирать `/edit` не требуется. `slug` — часть ссылки (`moy-otchet`),
**не ID отчета**. ID берется из JSON-ответа. Уровней групп может быть несколько.

После авторизации из предыдущего раздела:

```bash
set -euo pipefail

export REPORT_API_URL='http://192.168.88.100:3002'
# Замените на путь вашего отчета из адресной строки, без первого / и конечного /edit.
export REPORT_PATH='gruppa/podgruppa/reports/moy-otchet'

curl --fail-with-body -sS -b report-cookies.txt \
  "$REPORT_API_URL/api/groups/by-path/$REPORT_PATH" > existing-report.json

REPORT_ID=$(jq -er '.report.id' existing-report.json)
REPORT_GROUP_ID=$(jq -er '.report.groupId' existing-report.json)
REPORT_VERSION=$(jq -er '.report.version' existing-report.json)

# Проверьте, что получили именно нужный отчет.
jq '.report | {id, title, groupId, version}' existing-report.json
```

Сессию получайте на том же сервере: в примере авторизации установите
`REPORT_API_URL` в адрес нужного сервера **до входа**. Cookie от `localhost`
не авторизует запросы к `192.168.88.100`.

### 2. Загрузить фото для этого отчета

```bash
curl --fail-with-body -sS -b report-cookies.txt \
  -F "groupId=$REPORT_GROUP_ID" \
  -F "reportId=$REPORT_ID" \
  -F 'file=@./photo.jpg' \
  "$REPORT_API_URL/api/uploads" > existing-report-photo.json
```

Замените `./photo.jpg` на путь к своему файлу. Загрузка сохраняет файл;
чтобы он появился в содержимом отчета, добавьте фото-блок следующим запросом.
Для нескольких фото повторите загрузку каждого файла и передайте полученные
объекты `image` в массиве `data.images`.

### 3. Добавить текст, фото с настройками и задачу

```bash
jq -n --argjson version "$REPORT_VERSION" \
  --slurpfile uploaded existing-report-photo.json '{
  expectedReportVersion: $version,
  blocks: [
    {type: "text", data: {
      title: "Выполненные работы",
      content: "<p>Настроено оборудование и проверена работа сервисов.</p>"
    }},
    {type: "screenshot", data: {
      title: "Фото результата",
      description: "<p>Оборудование после настройки.</p>",
      layout: "full-width", imageSize: "large", customWidth: "80%", spacing: "medium",
      images: [($uploaded[0].image + {
        caption: "Результат работ", alt: "Настроенное оборудование",
        fit: "auto-height", align: "center"
      })]
    }},
    {type: "task", data: {
      title: "Проверить результат",
      description: "<p>Выполнить контрольную проверку.</p>",
      startDate: "2026-10-15", deadline: "2026-10-20",
      assignees: [], images: []
    }}
  ]
}' > existing-report-blocks.json

curl --fail-with-body -sS -b report-cookies.txt \
  -H 'Content-Type: application/json' \
  --data-binary @existing-report-blocks.json \
  "$REPORT_API_URL/api/reports/$REPORT_ID/blocks" > existing-report-added.json

REPORT_VERSION=$(jq -er '.reportVersion' existing-report-added.json)
```

Существующие блоки остаются, новые добавляются в конец. Можно передать только
один элемент в `blocks`, например только задачу. Секции, разделители,
исполнители и все настройки описаны ниже. Вместо примера дат укажите свои.

Для следующего добавления используйте новую `reportVersion`. При `409` перечитайте
`GET /api/reports/{id}`, проверьте изменения и сформируйте запрос с актуальной
версией. Не повторяйте успешный POST: повтор с новой версией добавит дубликаты.

### 4. Проверить результат и при необходимости опубликовать

```bash
curl --fail-with-body -sS -b report-cookies.txt \
  "$REPORT_API_URL/api/reports/$REPORT_ID" | jq '.report'
```

Обновите страницу редактора, чтобы увидеть добавленные через API блоки.
Публикацию выполните кнопкой интерфейса либо отдельным запросом `/publish`
с проверенной актуальной версией (пример ниже). Это отдельное действие:
добавление блоков не публикует новый снимок автоматически.

После получения ID можно хранить его в своей интеграции и обращаться напрямую
к `/api/reports/{id}`. При переименовании отчета URL со slug может измениться;
ID сохраняется, пока сам отчет не удален.

## Полный пример: создание нового отчета, файл, текст и фото

Нужны `curl`, `jq` и действующая сессия из примера выше.
Команды ниже создают **новый** отчет. Включите остановку скрипта при ошибке.

```bash
set -euo pipefail

# Получить доступные группы, включая вложенные.
curl --fail-with-body -sS -b report-cookies.txt \
  "$REPORT_API_URL/api/groups?tree=1" | jq '.groups[] | {id, name, path}'

export REPORT_GROUP_ID='ID_ГРУППЫ_ИЗ_ОТВЕТА'

jq -n --arg groupId "$REPORT_GROUP_ID" '{
  groupId: $groupId,
  title: "Отчет за октябрь",
  subtitle: "Результаты работ",
  client: "Компания",
  date: "2026-10-15",
  status: "draft"
}' > report-create.json

curl --fail-with-body -sS -b report-cookies.txt \
  -H 'Content-Type: application/json' --data-binary @report-create.json \
  "$REPORT_API_URL/api/reports" > report-created.json

REPORT_ID=$(jq -er '.report.id' report-created.json)
REPORT_VERSION=$(jq -er '.report.version' report-created.json)

# Файл загружается отдельно. Один файл на запрос, несколько фото — несколько запросов.
curl --fail-with-body -sS -b report-cookies.txt \
  -F "groupId=$REPORT_GROUP_ID" -F "reportId=$REPORT_ID" \
  -F 'file=@./photo.jpg' \
  "$REPORT_API_URL/api/uploads" > report-upload.json

# .image уже содержит url, uploadId, mimeType и alt.
jq -n --argjson version "$REPORT_VERSION" --slurpfile uploaded report-upload.json '{
  expectedReportVersion: $version,
  blocks: [
    {type: "text", data: {title: "Что сделано", content: "<p>Обновили главную страницу.</p>"}},
    {type: "screenshot", data: {
      title: "Результат", description: "<p>Главная после обновления.</p>",
      layout: "full-width", imageSize: "large", customWidth: "80%", spacing: "medium",
      images: [($uploaded[0].image + {
        caption: "Обновленная главная", alt: "Главная страница",
        fit: "auto-height", align: "center"
      })]
    }}
  ]
}' > report-blocks.json

curl --fail-with-body -sS -b report-cookies.txt \
  -H 'Content-Type: application/json' --data-binary @report-blocks.json \
  "$REPORT_API_URL/api/reports/$REPORT_ID/blocks" > report-added.json

REPORT_VERSION=$(jq -er '.reportVersion' report-added.json)

# Прочитать черновик и проверить результат.
curl --fail-with-body -sS -b report-cookies.txt \
  "$REPORT_API_URL/api/reports/$REPORT_ID" | jq '.report'
```

После проверки опубликуйте отдельным запросом:

```bash
jq -n --argjson version "$REPORT_VERSION" '{expectedVersion: $version}' > report-publish.json
curl --fail-with-body -sS -b report-cookies.txt \
  -H 'Content-Type: application/json' --data-binary @report-publish.json \
  "$REPORT_API_URL/api/reports/$REPORT_ID/publish"
```

Для существующего отчета сначала получите `GET /api/reports/{id}` и возьмите
`report.groupId` и `report.version`. Затем выполняйте загрузку и добавление блоков.
Не выполняйте повторно создание отчета.

## Типы и поля

Типы входных запросов и ответов экспортируются из `lib/report-api-types.ts`.
Это `import type`: код Prisma и серверная валидация не включаются в клиент.

```ts
import type {
  ApiBlockInput, AppendBlocksInput, AppendBlocksResponse,
  CreateReportApiInput, ApiReport, UploadApiResponse, ApiError,
} from '@/lib/report-api-types';

const photo: ApiBlockInput = {
  type: 'screenshot',
  data: {
    title: 'Фото',
    layout: 'two-column',
    imageSize: 'large',
    spacing: 'small',
    images: [
      {url: '/api/static/uploads/group/report/first.jpg', caption: 'До', fit: 'auto-width'},
      {url: '/api/static/uploads/group/report/second.jpg', caption: 'После', fit: 'auto-height', align: 'right'},
    ],
  },
};

const payload: AppendBlocksInput = {expectedReportVersion: 7, blocks: [photo]};
```

### Метаданные отчета

`POST /api/reports`: `title` и `groupId` обязательны. Опциональны `subtitle`,
`client`, `date` (календарная дата `YYYY-MM-DD`), `status` (`draft` или `published`).
Используйте `draft` и отдельную публикацию после заполнения. Ответ: `{report}`, HTTP 201.

`PATCH /api/reports/{id}` принимает `expectedVersion` и изменяемые поля:
`title`, `subtitle`, `client`, `date`, `groupId`, `status`, `excludeFromDateFilter`,
`isHidden`, `titleFontSize`, `descriptionFontSize`, `contentHeadingFontSize`,
`captionFontSize`. Размеры шрифта — строки с числом пикселей, например `"40"`.
Ответ: `{report}`. Для публикации с фиксацией снимка используйте `/publish`.

### Блоки

`POST /api/reports/{id}/blocks` принимает пакет `{expectedReportVersion, blocks}`
и возвращает `{blocks, reportVersion}`, HTTP 201. Сохраняет порядок массива.
Одиночный формат `{expectedReportVersion, type, data, parentId?}` возвращает
`{block, reportVersion}`. Переданное `position` при добавлении игнорируется:
сервер всегда добавляет в конец.

| `type` | `data` |
| --- | --- |
| `text` | `title?: string`, `content: string` |
| `screenshot` | `title?: string`, `description?: string`, `images: ImageData[]` и настройки ниже |
| `divider` | `{}` |
| `section` | `title?: string`, `sidebarCollapsed?: boolean`, `editorCollapsed?: boolean` |
| `task` | `title?: string`, `description?: string`, `images?: ImageData[]`, `layout?`, `createdAt?`, `startDate?`, `deadline?`, `assignees?`, `titleFontSize?`, `descriptionFontSize?` |

Текстовые поля поддерживают HTML редактора (`p`, `strong`, `em`, списки, ссылки,
заголовки); при добавлении опасный HTML очищается. Можно передать простой текст.
Отсутствующий `title` становится пустым. Для задачи сервер по умолчанию задает
`createdAt` (ISO 8601), пустые `images`/`assignees`, `startDate: null`, `deadline: null`.
Исполнитель: `{kind: "user" | "person", id, firstName, lastName}`.
Пользователей можно получить из `GET /api/users/assignees`, ручных исполнителей —
из `GET /api/task-people`. Даты задачи передаются строками, без даты — `null`.

`parentId` задается рядом с `type` и `data`, ссылается на существующую секцию
того же отчета. Сначала создайте секцию, затем передайте ее `block.id` при добавлении
дочерних блоков с новой версией отчета. Вложенные секции не поддерживаются.

### Пример задачи, секции и разделителя

Этот запрос добавляет три отдельных блока. Идентификаторы исполнителей берутся
из справочников, а `expectedReportVersion` — из актуального ответа API.

```json
{
  "expectedReportVersion": 5,
  "blocks": [
    {"type": "section", "data": {"title": "Следующие шаги", "sidebarCollapsed": false}},
    {
      "type": "task",
      "data": {
        "title": "Проверить адаптивную верстку",
        "description": "<p>Проверить главную страницу на телефоне.</p>",
        "startDate": "2026-10-15",
        "deadline": "2026-10-20",
        "assignees": [
          {"kind": "user", "id": "ID_ПОЛЬЗОВАТЕЛЯ", "firstName": "Иван", "lastName": "Иванов"}
        ],
        "layout": "two-column",
        "images": [
          {"url": "/api/static/uploads/group/report/reference.jpg", "caption": "Образец", "fit": "auto-height", "align": "center"}
        ]
      }
    },
    {"type": "divider", "data": {}}
  ]
}
```

Чтобы поместить задачу внутрь секции, создайте секцию отдельным запросом,
затем добавьте задачу с `parentId` полученной секции.

Отчет о выполнении задачи передается отдельным методом
`POST /api/reports/{id}/blocks/{blockId}/complete`:

```json
{
  "completedAt": "2026-10-20",
  "notes": "<p>Проверено на телефоне и планшете.</p>",
  "layout": "two-column",
  "images": [
    {"url": "/api/static/uploads/group/report/result.jpg", "caption": "Результат", "fit": "auto-height", "align": "center"}
  ]
}
```

`completedAt` обязателен, права проверяются по исполнителям задачи.
Повторное открытие: `DELETE` по тому же пути. Оба метода возвращают `{block}`;
после изменения перечитайте отчет. Они не публикуют новый снимок отчета автоматически.

### Все настройки фото

| Поле `data` фото-блока | Значения / поведение интерфейса |
| --- | --- |
| `layout` | `full-width` (по умолчанию), `sidebar` (описание слева), `sidebar-reverse` (описание справа), `two-column` (2 колонки на широком экране) |
| `imageSize` | `small`, `medium` (по умолчанию), `large`; для `auto-height` предел высоты 240/400/560 px |
| `customWidth` | CSS-ширина строкой, например `"80%"`, `"640px"`; применяется в макетах с одной колонкой и боковым описанием |
| `spacing` | `small`, `medium` (по умолчанию), `large` |
| `images` | Массив фото или вложений, порядок отображения соответствует массиву |

| Поле элемента `images` | Тип / назначение |
| --- | --- |
| `url` | Обязательно: путь `/api/static/uploads/...` или HTTP(S) URL |
| `uploadId` | ID из ответа загрузки; сохраняйте для управления файлом |
| `mimeType` | Например `image/jpeg` или `application/pdf` |
| `caption` | Подпись строкой |
| `alt` | Alt-текст / название вложения |
| `fit` | `auto-width` (ширина 100%, высота автоматически) или `auto-height` (ограниченная высота); старое `vertical` поддерживается |
| `align` | `left`, `center`, `right`; выравнивание при `auto-height` |

Поле `center` поддерживается для старых данных; в новых запросах используйте `align`.
Файлы загружаются как `multipart/form-data`, не как base64. Обязательны `file`
и `groupId`, `reportId` опционален; для отчетов передавайте оба ID.
Максимальный размер задаёт `MAX_UPLOAD_SIZE`, по умолчанию 10 MiB.
API сохраняет и обычные вложения; PNG/JPEG/WebP/GIF отображаются как изображения,
PDF и другие файлы — как ссылки. Доступ к загруженным файлам требует авторизации.
Внешние URL не копируются на сервер и должны быть доступны браузеру; для надежного
PDF используйте загрузку через API.

### Изменение настроек существующего фото-блока

Получите актуальный `GET /api/reports/{id}`. Найдите нужный блок по ID,
скопируйте **весь** его объект `data` и измените нужные настройки:

```ts
// report получен из GET, block — нужный screenshot-блок из report.blocks.
const body = {
  expectedReportVersion: report.version,
  data: {...block.data, layout: 'sidebar-reverse', customWidth: '60%'},
};
// PATCH /api/reports/{id}/blocks/{blockId}, JSON.stringify(body)
// Ответ: {block, reportVersion}.
```

`data` заменяется целиком: передача одного `{layout: "two-column"}` потеряет
остальные поля **этого блока**. Остальные блоки такой запрос не изменяет.
Не отправляйте `position`, если меняете только настройки фото.

## Полезные методы и ошибки

| Метод | Назначение |
| --- | --- |
| `GET /api/reports?groupId=...&allTime=1` | Все доступные отчеты группы; без `allTime=1` действует фильтр текущего месяца |
| `GET /api/reports/{id}` | Черновик для редактора, опубликованный снимок для читателя |
| `GET /api/uploads?reportId=...` | Загруженные файлы; URL составляется как `/api/static/uploads/` + `path` |
| `GET /api/reports/{id}/pdf` | Скачать PDF |
| `POST /api/auth/logout` | Завершить сессию |

Ошибки возвращаются как `{error, code?, issues?}`. `400` — неверные данные
(при валидации `code: VALIDATION_ERROR` и пути полей в `issues`), `401` — нужна
авторизация, `403` — недостаточно прав / требуется смена пароля, `404` — объект
не существует или недоступен, `409 VERSION_CONFLICT` — версия устарела.
Для скрытых объектов действуют существующие правила доступа приложения;
администратор может запрашивать их с `?showHidden=1` в рамках своих прав.

После сетевого обрыва проверьте отчет и список загрузок перед повтором POST:
сервер мог сохранить результат до обрыва. Idempotency-Key не поддерживается.

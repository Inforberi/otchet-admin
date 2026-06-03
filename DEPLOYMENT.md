# Production Deployment Guide

## Предварительные требования

- Docker & Docker Compose установлены
- PostgreSQL 16+ доступен (или через Docker)
- 512MB RAM минимум
- 2GB дискового пространства

## Быстрый Deploy

### 1. Клонировать репозиторий
```bash
git clone <your-repo>
cd admin-panel
```

### 2. Настроить переменные окружения
```bash
cp .env.template .env
# Отредактировать .env с production значениями
```

### 3. Запустить через Docker
```bash
make prod
```

`make prod` поднимает `postgres`, запускает одноразовый контейнер `migrate`, затем стартует `app`.

Приложение будет доступно на `http://127.0.0.1:3033`, если не меняли `APP_BIND_IP` и `APP_PORT`.

## Ручная настройка

### Шаг 1: База данных

Если используете внешний PostgreSQL:
```bash
# Создать БД
createdb admin_panel

# Обновить DATABASE_URL в .env
DATABASE_URL="postgresql://user:password@host:5432/admin_panel?schema=public"
```

### Шаг 2: Установка зависимостей
```bash
pnpm install
pnpm prisma:generate
pnpm playwright:install
```

### Шаг 3: Сборка
```bash
pnpm build
```

### Шаг 4: Миграции
```bash
pnpm prisma:migrate
```

### Шаг 5: Запуск
```bash
pnpm start
```

## Переменные окружения

### Обязательные
```env
DATABASE_URL="postgresql://..."
```

### Опциональные
```env
PORT=3000
UPLOAD_DIR="./uploads"
MAX_UPLOAD_SIZE=10485760
NODE_ENV=production
```

## Nginx конфигурация

Пример для reverse proxy:

```nginx
server {
    listen 80;
    server_name your-domain.com;

    client_max_body_size 20M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        alias /path/to/app/uploads/;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

## SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d your-domain.com
```

## Docker Production

### docker-compose.prod.yml
```yaml
services:
  postgres:
    image: postgres:16-alpine
    restart: always
    environment:
      POSTGRES_USER: ${DB_USER}
      POSTGRES_PASSWORD: ${DB_PASSWORD}
      POSTGRES_DB: ${DB_NAME}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    networks:
      - app-network

  app:
    build: .
    restart: always
    environment:
      DATABASE_URL: postgresql://${DB_USER}:${DB_PASSWORD}@postgres:5432/${DB_NAME}
      NODE_ENV: production
    ports:
      - "3000:3000"
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      - postgres
    networks:
      - app-network

volumes:
  postgres_data:

networks:
  app-network:
```

Запуск:
```bash
make prod
```

## Мониторинг

### Логи
```bash
# Docker
make logs

# PM2 (если используется)
pm2 logs admin-panel
```

### Здоровье приложения
```bash
curl http://localhost:3000/api/reports
```

### База данных
```bash
# Подключиться
psql $DATABASE_URL

# Размер БД
SELECT pg_size_pretty(pg_database_size('admin_panel'));

# Количество отчетов
SELECT COUNT(*) FROM reports;
```

## Backup

### База данных
```bash
# Создать backup
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Восстановить
psql $DATABASE_URL < backup_20260114.sql
```

### Загруженные файлы
```bash
# Backup uploads
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/

# Restore
tar -xzf uploads_backup_20260114.tar.gz
```

## Масштабирование

### Горизонтальное масштабирование

1. Вынести uploads на S3/MinIO
2. Использовать managed PostgreSQL (AWS RDS, DigitalOcean)
3. Запустить несколько инстансов app за Load Balancer

### Оптимизация

1. **CDN для статики**: CloudFlare, AWS CloudFront
2. **Кеширование**: Redis для сессий
3. **Индексы БД**: уже настроены в schema.prisma
4. **Connection pooling**: PgBouncer

## Безопасность

### Чеклист
- [ ] Изменить дефолтные пароли БД
- [ ] Настроить firewall (разрешить только 80/443)
- [ ] Включить HTTPS
- [ ] Ограничить размер загружаемых файлов
- [ ] Настроить rate limiting
- [ ] Регулярные backup
- [ ] Обновлять зависимости

### Rate Limiting (Nginx)
```nginx
limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

location /api/ {
    limit_req zone=api burst=20 nodelay;
    proxy_pass http://localhost:3000;
}
```

## Troubleshooting

### Ошибка подключения к БД
```bash
# Проверить доступность
pg_isready -h localhost -p 5432

# Проверить логи
docker logs admin-panel-db
```

### Ошибка генерации PDF
```bash
# Проверить что Playwright установлен
pnpm exec playwright --version

# Переустановить браузеры
pnpm exec playwright install chromium
```

### Out of Memory
```bash
# Увеличить memory limit для Node.js
NODE_OPTIONS="--max-old-space-size=2048" pnpm start
```

## Обновление приложения

```bash
# 1. Backup
make backup  # если есть скрипт

# 2. Обновить код
git pull origin main

# 3. Установить зависимости
pnpm install

# 4. Применить миграции
pnpm prisma:migrate

# 5. Пересобрать
pnpm build

# 6. Перезапустить
make restart
```

## Мониторинг производительности

### PM2 Monitoring
```bash
pm2 install pm2-logrotate
pm2 start npm --name "admin-panel" -- start
pm2 save
pm2 startup
```

### Metрики
- Response time API
- Количество отчетов
- Размер БД
- Использование диска (uploads)
- CPU/Memory usage

## Контакты поддержки

- GitHub Issues: <your-repo>/issues
- Email: support@your-domain.com

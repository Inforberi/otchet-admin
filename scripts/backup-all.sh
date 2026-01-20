#!/bin/bash

# Скрипт для создания полного бэкапа (база данных + uploads)
# Сохраняет бэкапы на рабочий стол пользователя в одной папке

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Параметры подключения к БД
DB_CONTAINER="admin-panel-db"
DB_USER="admin"
DB_NAME="admin_panel"

# Путь для сохранения бэкапов (рабочий стол)
BACKUP_BASE_DIR="$HOME/Desktop/otchet-admin-backups"
PROJECT_NAME="otchet-admin"
DATE_FULL=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_DIR="$BACKUP_BASE_DIR/${PROJECT_NAME}_${DATE_FULL}"

# Пути для бэкапа uploads
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPLOADS_DIR="${PROJECT_DIR}/uploads"

# Создаем директорию для бэкапов
mkdir -p "$BACKUP_BASE_DIR"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Создание полного бэкапа (БД + uploads)...${NC}"
echo -e "${YELLOW}Папка: $BACKUP_DIR${NC}"
echo ""

DB_SUCCESS=0
UPLOADS_SUCCESS=0

# Бэкап базы данных
echo -e "${YELLOW}=== Бэкап базы данных ===${NC}"
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo -e "${RED}Ошибка: Контейнер $DB_CONTAINER не запущен${NC}"
else
    BACKUP_FILE="$BACKUP_DIR/db.sql"
    BACKUP_FILE_COMPRESSED="$BACKUP_DIR/db.sql.gz"
    
    docker exec -e PGPASSWORD=password "$DB_CONTAINER" \
        pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists > "$BACKUP_FILE"
    
    if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
        gzip -c "$BACKUP_FILE" > "$BACKUP_FILE_COMPRESSED"
        rm "$BACKUP_FILE"
        FILE_SIZE=$(du -h "$BACKUP_FILE_COMPRESSED" | cut -f1)
        echo -e "${GREEN}✓ Бэкап БД создан: db.sql.gz (${FILE_SIZE})${NC}"
        DB_SUCCESS=1
    else
        echo -e "${RED}✗ Ошибка создания бэкапа БД${NC}"
    fi
fi

echo ""

# Бэкап uploads
echo -e "${YELLOW}=== Бэкап uploads ===${NC}"
if [ ! -d "$UPLOADS_DIR" ]; then
    echo -e "${RED}Ошибка: Директория uploads не найдена${NC}"
elif [ -z "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    echo -e "${YELLOW}Предупреждение: Директория uploads пуста${NC}"
else
    UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads.tar.gz"
    
    if tar -czf "$UPLOADS_BACKUP_FILE" -C "$PROJECT_DIR" uploads 2>/dev/null; then
        UPLOADS_SIZE=$(du -h "$UPLOADS_BACKUP_FILE" | cut -f1)
        echo -e "${GREEN}✓ Бэкап uploads создан: uploads.tar.gz (${UPLOADS_SIZE})${NC}"
        UPLOADS_SUCCESS=1
    else
        echo -e "${RED}✗ Ошибка создания бэкапа uploads${NC}"
    fi
fi

echo ""

# Удаляем старые бэкапы (оставляем последние 30 дней)
echo -e "${YELLOW}Очистка старых бэкапов (старше 30 дней)...${NC}"
find "$BACKUP_BASE_DIR" -type d -name "${PROJECT_NAME}_*" -mtime +30 -exec rm -rf {} + 2>/dev/null || true

# Итоговый результат
echo ""
if [ $DB_SUCCESS -eq 1 ] && [ $UPLOADS_SUCCESS -eq 1 ]; then
    echo -e "${GREEN}✓ Полный бэкап успешно создан${NC}"
    echo -e "${GREEN}  Папка: $BACKUP_DIR${NC}"
    exit 0
elif [ $DB_SUCCESS -eq 1 ]; then
    echo -e "${YELLOW}⚠ Бэкап БД создан, но бэкап uploads не удался${NC}"
    echo -e "${GREEN}  Папка: $BACKUP_DIR${NC}"
    exit 1
elif [ $UPLOADS_SUCCESS -eq 1 ]; then
    echo -e "${YELLOW}⚠ Бэкап uploads создан, но бэкап БД не удался${NC}"
    echo -e "${GREEN}  Папка: $BACKUP_DIR${NC}"
    exit 1
else
    echo -e "${RED}✗ Оба бэкапа не удались${NC}"
    exit 1
fi

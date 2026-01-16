#!/bin/bash

# Скрипт для создания бэкапа PostgreSQL базы данных
# Сохраняет бэкап на рабочий стол пользователя

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
DB_HOST="localhost"
DB_PORT="5433"

# Путь для сохранения бэкапов (рабочий стол)
BACKUP_DIR="$HOME/Desktop/otchet-admin-backups"
PROJECT_NAME="otchet-admin"
DATE_FULL=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_FILE="$BACKUP_DIR/${PROJECT_NAME}_${DATE_FULL}.sql"
BACKUP_FILE_COMPRESSED="$BACKUP_DIR/${PROJECT_NAME}_${DATE_FULL}.sql.gz"

# Создаем директорию для бэкапов, если её нет
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Создание бэкапа базы данных...${NC}"

# Проверяем, запущен ли контейнер
if ! docker ps | grep -q "$DB_CONTAINER"; then
    echo -e "${RED}Ошибка: Контейнер $DB_CONTAINER не запущен${NC}"
    exit 1
fi

# Создаем бэкап через docker exec
echo -e "${YELLOW}Экспорт базы данных...${NC}"
docker exec -e PGPASSWORD=password "$DB_CONTAINER" \
    pg_dump -U "$DB_USER" -d "$DB_NAME" --clean --if-exists > "$BACKUP_FILE"

# Проверяем успешность создания бэкапа
if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ] && [ -s "$BACKUP_FILE" ]; then
    echo -e "${GREEN}Бэкап создан: $BACKUP_FILE${NC}"
    
    # Сжимаем бэкап
    echo -e "${YELLOW}Сжатие бэкапа...${NC}"
    gzip -c "$BACKUP_FILE" > "$BACKUP_FILE_COMPRESSED"
    
    # Удаляем несжатый файл
    rm "$BACKUP_FILE"
    
    # Получаем размер файла
    FILE_SIZE=$(du -h "$BACKUP_FILE_COMPRESSED" | cut -f1)
    
    echo -e "${GREEN}✓ Бэкап успешно создан и сжат${NC}"
    echo -e "${GREEN}  Файл: $BACKUP_FILE_COMPRESSED${NC}"
    echo -e "${GREEN}  Размер: $FILE_SIZE${NC}"
    
    # Удаляем старые бэкапы (оставляем последние 30 дней)
    echo -e "${YELLOW}Очистка старых бэкапов (старше 30 дней)...${NC}"
    find "$BACKUP_DIR" -name "${PROJECT_NAME}_*.sql.gz" -type f -mtime +30 -delete
    echo -e "${GREEN}Готово${NC}"
    
    exit 0
else
    echo -e "${RED}Ошибка: Не удалось создать бэкап${NC}"
    exit 1
fi

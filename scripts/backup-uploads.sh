#!/bin/bash

# Скрипт для создания бэкапа директории uploads
# Сохраняет бэкап на рабочий стол пользователя в формате tar.gz

set -e

# Цвета для вывода
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Путь для сохранения бэкапов (рабочий стол)
BACKUP_BASE_DIR="$HOME/Desktop/otchet-admin-backups"
PROJECT_NAME="otchet-admin"
DATE_FULL=$(date +"%Y-%m-%d_%H%M%S")
BACKUP_DIR="$BACKUP_BASE_DIR/${PROJECT_NAME}_uploads_${DATE_FULL}"

# Пути для бэкапа uploads
PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
UPLOADS_DIR="${PROJECT_DIR}/uploads"
UPLOADS_BACKUP_FILE="$BACKUP_DIR/uploads.tar.gz"

# Создаем директорию для бэкапов, если её нет
mkdir -p "$BACKUP_BASE_DIR"
mkdir -p "$BACKUP_DIR"

echo -e "${YELLOW}Создание бэкапа uploads...${NC}"

# Проверяем существование директории uploads
if [ ! -d "$UPLOADS_DIR" ]; then
    echo -e "${RED}Ошибка: Директория uploads не найдена: $UPLOADS_DIR${NC}"
    exit 1
fi

# Проверяем, не пуста ли директория
if [ -z "$(ls -A "$UPLOADS_DIR" 2>/dev/null)" ]; then
    echo -e "${YELLOW}Предупреждение: Директория uploads пуста${NC}"
fi

# Создаем tar.gz архив uploads
echo -e "${YELLOW}Архивирование uploads...${NC}"
if tar -czf "$UPLOADS_BACKUP_FILE" -C "$PROJECT_DIR" uploads 2>/dev/null; then
    UPLOADS_SIZE=$(du -h "$UPLOADS_BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}✓ Бэкап uploads успешно создан${NC}"
    echo -e "${GREEN}  Папка: $BACKUP_DIR${NC}"
    echo -e "${GREEN}  Файл: uploads.tar.gz${NC}"
    echo -e "${GREEN}  Размер: $UPLOADS_SIZE${NC}"
    
    # Удаляем старые бэкапы (оставляем последние 30 дней)
    echo -e "${YELLOW}Очистка старых бэкапов uploads (старше 30 дней)...${NC}"
    find "$BACKUP_BASE_DIR" -type d -name "${PROJECT_NAME}_uploads_*" -mtime +30 -exec rm -rf {} + 2>/dev/null || true
    echo -e "${GREEN}Готово${NC}"
    
    exit 0
else
    echo -e "${RED}Ошибка: Не удалось создать бэкап uploads${NC}"
    exit 1
fi

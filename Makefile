.PHONY: help up down logs restart migrate migrate-create migrate-reset seed reset build clean dev dev-start backup backup-install backup-uninstall

help: ## Показать эту справку
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

up: ## Поднять все сервисы (БД + приложение)
	mkdir -p uploads
	docker compose up -d

down: ## Остановить все сервисы
	docker compose down

logs: ## Показать логи всех сервисов
	docker compose logs -f

logs-app: ## Показать логи приложения
	docker compose logs -f app

logs-db: ## Показать логи БД
	docker compose logs -f postgres

restart: ## Перезапустить все сервисы
	docker compose restart

migrate: ## Применить миграции БД
	pnpm prisma:migrate

migrate-dev: ## Создать и применить миграцию в dev режиме
	pnpm prisma:migrate:dev

migrate-create: ## Создать новую миграцию без применения
	pnpm prisma migrate dev --create-only

migrate-reset: ## Сбросить БД и применить все миграции заново
	pnpm prisma migrate reset --force

seed: ## Заполнить БД тестовыми данными
	pnpm prisma db seed

reset: down ## Полный сброс: остановить, удалить volumes, поднять заново
	docker compose down -v
	docker compose up -d

build: ## Собрать Docker образы заново
	docker compose build --no-cache

clean: ## Очистить Docker (образы, volumes, etc)
	docker compose down -v
	docker system prune -af --volumes

dev: ## Запустить приложение в dev режиме (локально, нужна запущенная БД)
	pnpm dev

dev-start: ## Запустить БД и dev-сервер (полный старт для разработки)
	@echo "🚀 Запуск dev окружения..."
	@mkdir -p uploads
	@echo "📦 Поднимаю БД..."
	@docker compose up -d postgres
	@echo "⏳ Жду готовности БД..."
	@sleep 2
	@echo "🔧 Генерирую Prisma Client..."
	@pnpm prisma:generate
	@echo "🎨 Запускаю dev-сервер на http://localhost:3000"
	@pnpm dev

install: ## Установить зависимости
	pnpm install

prisma-studio: ## Открыть Prisma Studio
	pnpm prisma:studio

prisma-generate: ## Сгенерировать Prisma Client
	pnpm prisma:generate

db-up: ## Поднять только БД
	docker compose up -d postgres

db-down: ## Остановить только БД
	docker compose stop postgres

backup: ## Создать ручной бэкап базы данных
	@chmod +x scripts/backup.sh
	@bash scripts/backup.sh

backup-install: ## Установить автоматический бэкап (раз в сутки в 3:00)
	@echo "Установка автоматического бэкапа..."
	@mkdir -p ~/Library/LaunchAgents
	@PROJECT_DIR="$$(pwd)" envsubst < scripts/com.otchet-admin.backup.plist.template > ~/Library/LaunchAgents/com.otchet-admin.backup.plist 2>/dev/null || \
		sed "s|PROJECT_DIR|$$(pwd)|g" scripts/com.otchet-admin.backup.plist.template > ~/Library/LaunchAgents/com.otchet-admin.backup.plist
	@launchctl load ~/Library/LaunchAgents/com.otchet-admin.backup.plist 2>/dev/null || launchctl bootstrap gui/$$(id -u) ~/Library/LaunchAgents/com.otchet-admin.backup.plist
	@echo "✓ Автоматический бэкап установлен (запуск каждый день в 3:00)"

backup-uninstall: ## Удалить автоматический бэкап
	@launchctl unload ~/Library/LaunchAgents/com.otchet-admin.backup.plist 2>/dev/null || launchctl bootout gui/$$(id -u) ~/Library/LaunchAgents/com.otchet-admin.backup.plist 2>/dev/null || true
	@rm -f ~/Library/LaunchAgents/com.otchet-admin.backup.plist
	@echo "✓ Автоматический бэкап удален"

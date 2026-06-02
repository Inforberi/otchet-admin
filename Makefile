.PHONY: help up down logs prod clean dev backup backup-db backup-uploads

help: ## Показать эту справку
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

up: ## Поднять docker compose без пересборки
	mkdir -p uploads
	docker compose up -d

down: ## Остановить все сервисы
	docker compose down

logs: ## Показать логи всех сервисов
	docker compose logs -f

prod: ## Продовый запуск: собрать образы и поднять сервисы
	@echo "Запуск prod окружения..."
	@mkdir -p uploads
	@echo "Собираю Docker образы..."
	@docker compose build --no-cache
	@echo "Поднимаю сервисы..."
	@docker compose up -d
	@echo "Готово. Миграции будут применены контейнером app при старте."

clean: ## Очистить Docker (образы, volumes, etc)
	docker compose down -v
	docker system prune -af --volumes

dev: ## Dev запуск: БД, Prisma generate, migrate deploy и dev-сервер
	@echo "🚀 Запуск dev окружения..."
	@mkdir -p uploads
	@echo "📦 Поднимаю БД..."
	@docker compose up -d postgres
	@echo "⏳ Жду готовности БД..."
	@sleep 3
	@echo "🔧 Генерирую Prisma Client..."
	@pnpm prisma:generate
	@echo "🗃️ Применяю миграции..."
	@pnpm prisma:migrate
	@echo "🎨 Запускаю dev-сервер на http://localhost:3000"
	@pnpm dev

backup: ## Создать бэкап БД и uploads
	@$(MAKE) backup-db
	@$(MAKE) backup-uploads

backup-db: ## Создать бэкап только базы данных
	@chmod +x scripts/backup-db.sh
	@bash scripts/backup-db.sh

backup-uploads: ## Создать бэкап только uploads
	@chmod +x scripts/backup-uploads.sh
	@bash scripts/backup-uploads.sh

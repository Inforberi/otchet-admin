.PHONY: help up down logs prod prod-rebuild clean dev backup backup-db backup-uploads typecheck

help: ## Показать эту справку
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

up: ## Поднять docker compose без пересборки
	@echo "📦 Поднимаю PostgreSQL..."
	@mkdir -p uploads && chmod 777 uploads
	@docker compose up -d postgres
	@echo "🗃️  Применяю миграции..."
	@docker compose run --rm migrate
	@echo "🚀 Поднимаю приложение..."
	@docker compose up -d app
	@echo "✅ Готово."

down: ## Остановить все сервисы
	docker compose down

logs: ## Показать логи всех сервисов
	docker compose logs -f

# ─────────────────────────────────────────────
#  prod — сборка С кешем (быстро, для деплоя)
#  Пересобирает только изменившиеся слои.
#  playwright-base кешируется отдельно и почти
#  никогда не пересобирается.
# ─────────────────────────────────────────────
prod:
	@echo "🚀 Deploy..."
	@mkdir -p uploads && chmod 777 uploads
	@docker compose up -d --build
	@docker compose run --rm migrate
	@docker compose up -d

# ─────────────────────────────────────────────
#  prod-rebuild — полная пересборка без кеша
#  Нужен только при смене базовых образов,
#  обновлении Playwright или системных пакетов.
# ─────────────────────────────────────────────
prod-rebuild: ## Полная пересборка без кеша (медленно, только при необходимости)
	@echo "⚠️  Полная пересборка без кеша..."
	@test -f .env || (echo "❌ Не найден .env. Скопируй .env.template в .env и заполни значения." && exit 1)
	@mkdir -p uploads && chmod 777 uploads
	@docker compose build --no-cache
	@echo "📦 Поднимаю PostgreSQL..."
	@docker compose up -d postgres
	@echo "🗃️  Применяю миграции..."
	@docker compose run --rm migrate
	@echo "🚀 Поднимаю приложение..."
	@docker compose up -d app
	@echo "✅ Готово."

clean: ## Очистить Docker (образы, volumes, etc)
	docker compose down -v
	docker system prune -af --volumes

# ─────────────────────────────────────────────
#  dev — локальная разработка
#  Ждёт готовности БД через healthcheck вместо sleep
# ─────────────────────────────────────────────
dev: ## Dev запуск: БД, Prisma generate, migrate deploy и dev-сервер
	@echo "🚀 Запуск dev окружения..."
	@mkdir -p uploads && chmod 777 uploads
	@echo "📦 Поднимаю БД..."
	@docker compose up -d postgres
	@echo "⏳ Жду готовности БД..."
	@until docker compose exec postgres pg_isready -q 2>/dev/null; do \
		printf '.'; sleep 1; \
	done; echo ""
	@echo "🔧 Генерирую Prisma Client..."
	@pnpm prisma:generate
	@echo "🗃️  Применяю миграции..."
	@pnpm prisma:migrate
	@echo "🎨 Запускаю dev-сервер на http://localhost:3000"
	@pnpm dev

# ─────────────────────────────────────────────
#  Бэкапы
# ─────────────────────────────────────────────
backup: ## Создать бэкап БД и uploads
	@$(MAKE) backup-db
	@$(MAKE) backup-uploads

backup-db: ## Создать бэкап только базы данных
	@chmod +x scripts/backup-db.sh
	@bash scripts/backup-db.sh

backup-uploads: ## Создать бэкап только uploads
	@chmod +x scripts/backup-uploads.sh
	@bash scripts/backup-uploads.sh

typecheck: ## Проверить TypeScript без сборки
	pnpm exec tsc --noEmit

.PHONY: help up down logs restart migrate migrate-create migrate-reset seed reset build clean dev

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

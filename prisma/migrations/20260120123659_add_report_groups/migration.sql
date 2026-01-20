-- CreateTable
CREATE TABLE IF NOT EXISTS "report_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "report_groups_name_key" ON "report_groups"("name");

-- Создаем дефолтные группы
INSERT INTO "report_groups" ("id", "name", "description", "order", "created_at", "updated_at")
VALUES 
    (gen_random_uuid()::text, 'Отчеты по сайту', 'Отчеты по аудиту и анализу сайтов', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    (gen_random_uuid()::text, 'Документация', 'Техническая документация и инструкции', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("name") DO NOTHING;

-- Получаем ID дефолтной группы
DO $$
DECLARE
    default_group_id TEXT;
BEGIN
    SELECT id INTO default_group_id FROM "report_groups" WHERE "name" = 'Отчеты по сайту' LIMIT 1;
    
    -- Если группы нет, создаем её
    IF default_group_id IS NULL THEN
        INSERT INTO "report_groups" ("id", "name", "description", "order", "created_at", "updated_at")
        VALUES (gen_random_uuid()::text, 'Отчеты по сайту', 'Отчеты по аудиту и анализу сайтов', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING id INTO default_group_id;
    END IF;
    
    -- Добавляем колонку group_id в reports, если её нет
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'reports' AND column_name = 'group_id') THEN
        ALTER TABLE "reports" ADD COLUMN "group_id" TEXT;
    END IF;
    
    -- Обновляем существующие отчеты
    UPDATE "reports" SET "group_id" = default_group_id WHERE "group_id" IS NULL OR "group_id" = '';
    
    -- Делаем колонку обязательной после заполнения
    ALTER TABLE "reports" ALTER COLUMN "group_id" SET NOT NULL;
    
    -- Добавляем колонку group_id в uploads, если её нет
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'uploads' AND column_name = 'group_id') THEN
        ALTER TABLE "uploads" ADD COLUMN "group_id" TEXT;
    END IF;
    
    -- Обновляем существующие загрузки
    UPDATE "uploads" SET "group_id" = default_group_id WHERE "group_id" IS NULL OR "group_id" = '';
    
    -- Делаем колонку обязательной после заполнения
    ALTER TABLE "uploads" ALTER COLUMN "group_id" SET NOT NULL;
END $$;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reports_group_id_idx" ON "reports"("group_id");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "uploads_group_id_idx" ON "uploads"("group_id");

-- AddForeignKey
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'reports_group_id_fkey'
    ) THEN
        ALTER TABLE "reports" ADD CONSTRAINT "reports_group_id_fkey" 
        FOREIGN KEY ("group_id") REFERENCES "report_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uploads_group_id_fkey'
    ) THEN
        ALTER TABLE "uploads" ADD CONSTRAINT "uploads_group_id_fkey" 
        FOREIGN KEY ("group_id") REFERENCES "report_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

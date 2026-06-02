ALTER TABLE "report_groups"
ADD COLUMN IF NOT EXISTS "parent_id" TEXT,
ADD COLUMN IF NOT EXISTS "path" TEXT;

UPDATE "report_groups"
SET "path" = "slug"
WHERE "path" IS NULL OR "path" = '';

ALTER TABLE "report_groups"
ALTER COLUMN "path" SET NOT NULL;

ALTER TABLE "report_groups"
DROP CONSTRAINT IF EXISTS "report_groups_name_key";

DROP INDEX IF EXISTS "report_groups_name_key";
DROP INDEX IF EXISTS "report_groups_slug_key";

CREATE UNIQUE INDEX IF NOT EXISTS "report_groups_path_key" ON "report_groups"("path");
CREATE INDEX IF NOT EXISTS "report_groups_parent_id_idx" ON "report_groups"("parent_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'report_groups_parent_id_fkey'
    ) THEN
        ALTER TABLE "report_groups"
        ADD CONSTRAINT "report_groups_parent_id_fkey"
        FOREIGN KEY ("parent_id") REFERENCES "report_groups"("id")
        ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

ALTER TABLE "reports"
ADD COLUMN "draft_hash" TEXT,
ADD COLUMN "published_hash" TEXT,
ADD COLUMN "published_snapshot" JSONB,
ADD COLUMN "published_at" TIMESTAMP(3),
ADD COLUMN "draft_updated_at" TIMESTAMP(3);

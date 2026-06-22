-- AlterTable
ALTER TABLE "reports" ADD COLUMN "created_by_user_id" TEXT,
ADD COLUMN "is_hidden" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "reports_created_by_user_id_idx" ON "reports"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

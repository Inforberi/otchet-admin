-- AlterTable
ALTER TABLE "report_groups" ADD COLUMN "created_by_user_id" TEXT,
ADD COLUMN "is_hidden" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "reports" ADD COLUMN "exclude_from_date_filter" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "report_groups_created_by_user_id_idx" ON "report_groups"("created_by_user_id");

-- AddForeignKey
ALTER TABLE "report_groups" ADD CONSTRAINT "report_groups_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

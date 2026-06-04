-- AlterTable
ALTER TABLE "report_blocks" ADD COLUMN "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "report_blocks_parent_id_idx" ON "report_blocks"("parent_id");

-- AddForeignKey
ALTER TABLE "report_blocks" ADD CONSTRAINT "report_blocks_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "report_blocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

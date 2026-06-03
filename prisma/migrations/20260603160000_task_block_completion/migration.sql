-- Add task completion fields to report_blocks
ALTER TABLE "report_blocks" ADD COLUMN IF NOT EXISTS "task_completed_at" TIMESTAMP(3);
ALTER TABLE "report_blocks" ADD COLUMN IF NOT EXISTS "task_completed_by_user_id" TEXT;

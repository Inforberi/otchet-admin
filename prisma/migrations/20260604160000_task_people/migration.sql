-- CreateTable
CREATE TABLE "task_people" (
    "id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_people_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_people_is_active_last_name_first_name_idx" ON "task_people"("is_active", "last_name", "first_name");

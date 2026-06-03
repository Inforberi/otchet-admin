CREATE TABLE "user_group_access" (
    "user_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,

    CONSTRAINT "user_group_access_pkey" PRIMARY KEY ("user_id","group_id")
);

CREATE INDEX "user_group_access_group_id_idx" ON "user_group_access"("group_id");

ALTER TABLE "user_group_access" ADD CONSTRAINT "user_group_access_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_group_access" ADD CONSTRAINT "user_group_access_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "report_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

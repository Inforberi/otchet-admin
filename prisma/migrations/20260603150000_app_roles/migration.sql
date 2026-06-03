CREATE TABLE "app_roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "can_edit_content" BOOLEAN NOT NULL DEFAULT false,
    "can_manage_users" BOOLEAN NOT NULL DEFAULT false,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "restrict_groups" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "app_roles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "app_roles_name_key" ON "app_roles"("name");

CREATE TABLE "app_role_groups" (
    "role_id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,

    CONSTRAINT "app_role_groups_pkey" PRIMARY KEY ("role_id","group_id")
);

CREATE INDEX "app_role_groups_group_id_idx" ON "app_role_groups"("group_id");

ALTER TABLE "app_role_groups" ADD CONSTRAINT "app_role_groups_role_id_fkey" FOREIGN KEY ("role_id") REFERENCES "app_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_role_groups" ADD CONSTRAINT "app_role_groups_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "report_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "app_roles" ("id", "name", "can_edit_content", "can_manage_users", "is_system", "restrict_groups", "created_at", "updated_at")
VALUES
    ('00000000-0000-0000-0000-000000000001', 'super_admin', true, true, true, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000002', 'Редактор', true, false, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
    ('00000000-0000-0000-0000-000000000003', 'Просмотр', false, false, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

ALTER TABLE "users" ADD COLUMN "app_role_id" TEXT;

UPDATE "users" SET "app_role_id" = '00000000-0000-0000-0000-000000000001' WHERE "role" = 'super_admin';
UPDATE "users" SET "app_role_id" = '00000000-0000-0000-0000-000000000002' WHERE "role" = 'editor';
UPDATE "users" SET "app_role_id" = '00000000-0000-0000-0000-000000000003' WHERE "role" = 'viewer';
UPDATE "users" SET "app_role_id" = '00000000-0000-0000-0000-000000000002' WHERE "app_role_id" IS NULL;

INSERT INTO "app_role_groups" ("role_id", "group_id")
SELECT '00000000-0000-0000-0000-000000000003', "group_id"
FROM "user_group_access"
ON CONFLICT DO NOTHING;

ALTER TABLE "users" ALTER COLUMN "app_role_id" SET NOT NULL;

ALTER TABLE "users" ADD CONSTRAINT "users_app_role_id_fkey" FOREIGN KEY ("app_role_id") REFERENCES "app_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "user_group_access";

ALTER TABLE "users" DROP COLUMN "role";

DROP INDEX IF EXISTS "users_role_idx";

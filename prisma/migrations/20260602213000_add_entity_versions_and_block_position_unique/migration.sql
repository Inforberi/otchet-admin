ALTER TABLE "report_groups"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "reports"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "report_blocks"
ADD COLUMN "version" INTEGER NOT NULL DEFAULT 1;

WITH ordered_blocks AS (
    SELECT
        id,
        ROW_NUMBER() OVER (
            PARTITION BY report_id
            ORDER BY position ASC, created_at ASC, id ASC
        ) - 1 AS next_position
    FROM report_blocks
)
UPDATE report_blocks AS rb
SET position = ordered_blocks.next_position
FROM ordered_blocks
WHERE rb.id = ordered_blocks.id;

CREATE UNIQUE INDEX "report_blocks_report_id_position_key"
ON "report_blocks"("report_id", "position");

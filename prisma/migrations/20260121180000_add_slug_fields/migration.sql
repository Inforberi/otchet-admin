-- Add slug column to report_groups
ALTER TABLE "report_groups" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "report_groups_slug_key" ON "report_groups"("slug");
CREATE INDEX IF NOT EXISTS "report_groups_slug_idx" ON "report_groups"("slug");

-- Add slug column to reports
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "slug" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "reports_groupId_slug_key" ON "reports"("group_id", "slug");

-- Generate slugs for existing groups if they don't have one
DO $$
DECLARE
    group_record RECORD;
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER;
BEGIN
    FOR group_record IN SELECT id, name FROM "report_groups" WHERE slug IS NULL OR slug = '' LOOP
        -- Simple transliteration and slug generation
        base_slug := lower(regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(group_record.name, '[а-яё]', '', 'g'),
                    '[^a-z0-9]+', '-', 'g'
                ),
                '^-+|-+$', '', 'g'
            ),
            '^(.{0,100}).*$', '\1', 'g'
        ));
        
        IF base_slug = '' THEN
            base_slug := 'group';
        END IF;
        
        final_slug := base_slug;
        counter := 1;
        
        -- Ensure uniqueness
        WHILE EXISTS (SELECT 1 FROM "report_groups" WHERE slug = final_slug AND id != group_record.id) LOOP
            final_slug := base_slug || '-' || counter;
            counter := counter + 1;
        END LOOP;
        
        UPDATE "report_groups" SET slug = final_slug WHERE id = group_record.id;
    END LOOP;
END $$;

-- Generate slugs for existing reports if they don't have one
DO $$
DECLARE
    report_record RECORD;
    base_slug TEXT;
    final_slug TEXT;
    counter INTEGER;
BEGIN
    FOR report_record IN SELECT id, title, group_id FROM "reports" WHERE slug IS NULL OR slug = '' LOOP
        -- Simple transliteration and slug generation
        base_slug := lower(regexp_replace(
            regexp_replace(
                regexp_replace(
                    regexp_replace(report_record.title, '[а-яё]', '', 'g'),
                    '[^a-z0-9]+', '-', 'g'
                ),
                '^-+|-+$', '', 'g'
            ),
            '^(.{0,100}).*$', '\1', 'g'
        ));
        
        IF base_slug = '' THEN
            base_slug := 'report';
        END IF;
        
        final_slug := base_slug;
        counter := 1;
        
        -- Ensure uniqueness within group
        WHILE EXISTS (SELECT 1 FROM "reports" WHERE group_id = report_record.group_id AND slug = final_slug AND id != report_record.id) LOOP
            final_slug := base_slug || '-' || counter;
            counter := counter + 1;
        END LOOP;
        
        UPDATE "reports" SET slug = final_slug WHERE id = report_record.id;
    END LOOP;
END $$;

-- Make slug NOT NULL after populating (only if not already NOT NULL)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'report_groups' 
        AND column_name = 'slug' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "report_groups" ALTER COLUMN "slug" SET NOT NULL;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'reports' 
        AND column_name = 'slug' 
        AND is_nullable = 'NO'
    ) THEN
        ALTER TABLE "reports" ALTER COLUMN "slug" SET NOT NULL;
    END IF;
END $$;

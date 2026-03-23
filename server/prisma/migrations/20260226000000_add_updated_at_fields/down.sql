-- Rollback migration: 20260226000000_add_updated_at_fields
-- Run manually: psql $DATABASE_URL -f down.sql

ALTER TABLE "book_appearance" DROP COLUMN IF EXISTS "updated_at";
ALTER TABLE "book_sounds" DROP COLUMN IF EXISTS "updated_at";
ALTER TABLE "book_default_settings" DROP COLUMN IF EXISTS "updated_at";
ALTER TABLE "ambients" DROP COLUMN IF EXISTS "updated_at";
ALTER TABLE "decorative_fonts" DROP COLUMN IF EXISTS "updated_at";
ALTER TABLE "reading_fonts" DROP COLUMN IF EXISTS "updated_at";
ALTER TABLE "global_settings" DROP COLUMN IF EXISTS "updated_at";

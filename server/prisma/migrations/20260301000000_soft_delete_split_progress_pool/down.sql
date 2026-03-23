-- Rollback migration: 20260301000000_soft_delete_split_progress_pool
-- Run manually: psql $DATABASE_URL -f down.sql

-- 1. Restore preference columns to reading_progress
ALTER TABLE "reading_progress" ADD COLUMN "font" VARCHAR(100) NOT NULL DEFAULT 'georgia';
ALTER TABLE "reading_progress" ADD COLUMN "font_size" INTEGER NOT NULL DEFAULT 18;
ALTER TABLE "reading_progress" ADD COLUMN "theme" VARCHAR(20) NOT NULL DEFAULT 'light';
ALTER TABLE "reading_progress" ADD COLUMN "sound_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "reading_progress" ADD COLUMN "sound_volume" REAL NOT NULL DEFAULT 0.3;
ALTER TABLE "reading_progress" ADD COLUMN "ambient_type" VARCHAR(100) NOT NULL DEFAULT 'none';
ALTER TABLE "reading_progress" ADD COLUMN "ambient_volume" REAL NOT NULL DEFAULT 0.5;

-- Migrate preferences data back
UPDATE "reading_progress" rp
SET
  "font" = rpr."font",
  "font_size" = rpr."font_size",
  "theme" = rpr."theme",
  "sound_enabled" = rpr."sound_enabled",
  "sound_volume" = rpr."sound_volume",
  "ambient_type" = rpr."ambient_type",
  "ambient_volume" = rpr."ambient_volume"
FROM "reading_preferences" rpr
WHERE rp."user_id" = rpr."user_id" AND rp."book_id" = rpr."book_id";

-- Drop reading_preferences table
DROP TABLE IF EXISTS "reading_preferences";

-- 2. Remove soft delete
DROP INDEX IF EXISTS "books_user_id_deleted_at_idx";
ALTER TABLE "books" DROP COLUMN IF EXISTS "deleted_at";

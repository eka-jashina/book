-- 1. Soft delete: add deleted_at column to books
ALTER TABLE "books" ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- Index for filtering active books per user
CREATE INDEX "books_user_id_deleted_at_idx" ON "books"("user_id", "deleted_at");

-- 2. Split ReadingProgress: extract preferences into separate table

-- Create reading_preferences table
CREATE TABLE "reading_preferences" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "font" VARCHAR(100) NOT NULL DEFAULT 'georgia',
    "font_size" INTEGER NOT NULL DEFAULT 18,
    "theme" VARCHAR(20) NOT NULL DEFAULT 'light',
    "sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sound_volume" REAL NOT NULL DEFAULT 0.3,
    "ambient_type" VARCHAR(100) NOT NULL DEFAULT 'none',
    "ambient_volume" REAL NOT NULL DEFAULT 0.5,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_preferences_pkey" PRIMARY KEY ("id")
);

-- Migrate existing preferences data from reading_progress
INSERT INTO "reading_preferences" ("user_id", "book_id", "font", "font_size", "theme", "sound_enabled", "sound_volume", "ambient_type", "ambient_volume", "updated_at")
SELECT "user_id", "book_id", "font", "font_size", "theme", "sound_enabled", "sound_volume", "ambient_type", "ambient_volume", "updated_at"
FROM "reading_progress";

-- Drop preference columns from reading_progress
ALTER TABLE "reading_progress" DROP COLUMN "font";
ALTER TABLE "reading_progress" DROP COLUMN "font_size";
ALTER TABLE "reading_progress" DROP COLUMN "theme";
ALTER TABLE "reading_progress" DROP COLUMN "sound_enabled";
ALTER TABLE "reading_progress" DROP COLUMN "sound_volume";
ALTER TABLE "reading_progress" DROP COLUMN "ambient_type";
ALTER TABLE "reading_progress" DROP COLUMN "ambient_volume";

-- Add constraints and indexes to reading_preferences
CREATE UNIQUE INDEX "reading_preferences_user_id_book_id_key" ON "reading_preferences"("user_id", "book_id");
CREATE INDEX "reading_preferences_user_id_book_id_idx" ON "reading_preferences"("user_id", "book_id");

-- Add foreign keys
ALTER TABLE "reading_preferences" ADD CONSTRAINT "reading_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reading_preferences" ADD CONSTRAINT "reading_preferences_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

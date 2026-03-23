-- Rollback migration: 20260223000000_init
-- Run manually: psql $DATABASE_URL -f down.sql
-- WARNING: This drops ALL application tables. Data will be lost.

DROP TABLE IF EXISTS "reading_progress" CASCADE;
DROP TABLE IF EXISTS "global_settings" CASCADE;
DROP TABLE IF EXISTS "reading_fonts" CASCADE;
DROP TABLE IF EXISTS "decorative_fonts" CASCADE;
DROP TABLE IF EXISTS "ambients" CASCADE;
DROP TABLE IF EXISTS "book_default_settings" CASCADE;
DROP TABLE IF EXISTS "book_sounds" CASCADE;
DROP TABLE IF EXISTS "book_appearance" CASCADE;
DROP TABLE IF EXISTS "chapters" CASCADE;
DROP TABLE IF EXISTS "books" CASCADE;
DROP TABLE IF EXISTS "users" CASCADE;

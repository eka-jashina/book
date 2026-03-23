-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "display_name" VARCHAR(100),
    "avatar_url" VARCHAR(500),
    "google_id" VARCHAR(255),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "books" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL DEFAULT '',
    "author" VARCHAR(500) NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "cover_bg" VARCHAR(500) NOT NULL DEFAULT '',
    "cover_bg_mobile" VARCHAR(500) NOT NULL DEFAULT '',
    "cover_bg_mode" VARCHAR(20) NOT NULL DEFAULT 'default',
    "cover_bg_custom_url" VARCHAR(500),
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "book_id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL DEFAULT '',
    "position" INTEGER NOT NULL DEFAULT 0,
    "file_path" VARCHAR(500),
    "html_content" TEXT,
    "bg" VARCHAR(500) NOT NULL DEFAULT '',
    "bg_mobile" VARCHAR(500) NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_appearance" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "book_id" UUID NOT NULL,
    "font_min" INTEGER NOT NULL DEFAULT 14,
    "font_max" INTEGER NOT NULL DEFAULT 22,
    "light_cover_bg_start" VARCHAR(20) NOT NULL DEFAULT '#3a2d1f',
    "light_cover_bg_end" VARCHAR(20) NOT NULL DEFAULT '#2a2016',
    "light_cover_text" VARCHAR(20) NOT NULL DEFAULT '#f2e9d8',
    "light_cover_bg_image_url" VARCHAR(500),
    "light_page_texture" VARCHAR(20) NOT NULL DEFAULT 'default',
    "light_custom_texture_url" VARCHAR(500),
    "light_bg_page" VARCHAR(20) NOT NULL DEFAULT '#fdfcf8',
    "light_bg_app" VARCHAR(20) NOT NULL DEFAULT '#e6e3dc',
    "dark_cover_bg_start" VARCHAR(20) NOT NULL DEFAULT '#111111',
    "dark_cover_bg_end" VARCHAR(20) NOT NULL DEFAULT '#000000',
    "dark_cover_text" VARCHAR(20) NOT NULL DEFAULT '#eaeaea',
    "dark_cover_bg_image_url" VARCHAR(500),
    "dark_page_texture" VARCHAR(20) NOT NULL DEFAULT 'none',
    "dark_custom_texture_url" VARCHAR(500),
    "dark_bg_page" VARCHAR(20) NOT NULL DEFAULT '#1e1e1e',
    "dark_bg_app" VARCHAR(20) NOT NULL DEFAULT '#121212',

    CONSTRAINT "book_appearance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_sounds" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "book_id" UUID NOT NULL,
    "page_flip_url" VARCHAR(500) NOT NULL DEFAULT 'sounds/page-flip.mp3',
    "book_open_url" VARCHAR(500) NOT NULL DEFAULT 'sounds/cover-flip.mp3',
    "book_close_url" VARCHAR(500) NOT NULL DEFAULT 'sounds/cover-flip.mp3',

    CONSTRAINT "book_sounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "book_default_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "book_id" UUID NOT NULL,
    "font" VARCHAR(100) NOT NULL DEFAULT 'georgia',
    "font_size" INTEGER NOT NULL DEFAULT 18,
    "theme" VARCHAR(20) NOT NULL DEFAULT 'light',
    "sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sound_volume" REAL NOT NULL DEFAULT 0.3,
    "ambient_type" VARCHAR(100) NOT NULL DEFAULT 'none',
    "ambient_volume" REAL NOT NULL DEFAULT 0.5,

    CONSTRAINT "book_default_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ambients" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "book_id" UUID NOT NULL,
    "ambient_key" VARCHAR(100) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "short_label" VARCHAR(50),
    "icon" VARCHAR(20),
    "file_url" VARCHAR(500),
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ambients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "decorative_fonts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "book_id" UUID NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,

    CONSTRAINT "decorative_fonts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_fonts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "font_key" VARCHAR(100) NOT NULL,
    "label" VARCHAR(200) NOT NULL,
    "family" VARCHAR(300) NOT NULL,
    "builtin" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "file_url" VARCHAR(500),
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "reading_fonts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "global_settings" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "font_min" INTEGER NOT NULL DEFAULT 14,
    "font_max" INTEGER NOT NULL DEFAULT 22,
    "vis_font_size" BOOLEAN NOT NULL DEFAULT true,
    "vis_theme" BOOLEAN NOT NULL DEFAULT true,
    "vis_font" BOOLEAN NOT NULL DEFAULT true,
    "vis_fullscreen" BOOLEAN NOT NULL DEFAULT true,
    "vis_sound" BOOLEAN NOT NULL DEFAULT true,
    "vis_ambient" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "global_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reading_progress" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "page" INTEGER NOT NULL DEFAULT 0,
    "font" VARCHAR(100) NOT NULL DEFAULT 'georgia',
    "font_size" INTEGER NOT NULL DEFAULT 18,
    "theme" VARCHAR(20) NOT NULL DEFAULT 'light',
    "sound_enabled" BOOLEAN NOT NULL DEFAULT true,
    "sound_volume" REAL NOT NULL DEFAULT 0.3,
    "ambient_type" VARCHAR(100) NOT NULL DEFAULT 'none',
    "ambient_volume" REAL NOT NULL DEFAULT 0.5,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT "reading_progress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");

CREATE INDEX "idx_books_user_id" ON "books"("user_id");
CREATE INDEX "idx_books_position" ON "books"("user_id", "position");

CREATE INDEX "idx_chapters_book_id" ON "chapters"("book_id");
CREATE INDEX "idx_chapters_position" ON "chapters"("book_id", "position");

CREATE UNIQUE INDEX "book_appearance_book_id_key" ON "book_appearance"("book_id");
CREATE UNIQUE INDEX "book_sounds_book_id_key" ON "book_sounds"("book_id");
CREATE UNIQUE INDEX "book_default_settings_book_id_key" ON "book_default_settings"("book_id");
CREATE UNIQUE INDEX "decorative_fonts_book_id_key" ON "decorative_fonts"("book_id");
CREATE UNIQUE INDEX "global_settings_user_id_key" ON "global_settings"("user_id");

CREATE INDEX "idx_ambients_book_id" ON "ambients"("book_id");
CREATE INDEX "idx_reading_fonts_user_id" ON "reading_fonts"("user_id");

CREATE UNIQUE INDEX "reading_progress_user_id_book_id_key" ON "reading_progress"("user_id", "book_id");
CREATE INDEX "idx_reading_progress_user_book" ON "reading_progress"("user_id", "book_id");

-- AddForeignKey
ALTER TABLE "books" ADD CONSTRAINT "books_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_appearance" ADD CONSTRAINT "book_appearance_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_sounds" ADD CONSTRAINT "book_sounds_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "book_default_settings" ADD CONSTRAINT "book_default_settings_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ambients" ADD CONSTRAINT "ambients_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "decorative_fonts" ADD CONSTRAINT "decorative_fonts_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reading_fonts" ADD CONSTRAINT "reading_fonts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "global_settings" ADD CONSTRAINT "global_settings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "reading_progress" ADD CONSTRAINT "reading_progress_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable
CREATE TABLE "reading_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "book_id" UUID NOT NULL,
    "start_page" INTEGER NOT NULL DEFAULT 0,
    "end_page" INTEGER NOT NULL DEFAULT 0,
    "pages_read" INTEGER NOT NULL DEFAULT 0,
    "duration_sec" INTEGER NOT NULL DEFAULT 0,
    "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reading_sessions_user_id_idx" ON "reading_sessions"("user_id");

-- CreateIndex
CREATE INDEX "reading_sessions_user_id_book_id_idx" ON "reading_sessions"("user_id", "book_id");

-- CreateIndex
CREATE INDEX "reading_sessions_book_id_ended_at_idx" ON "reading_sessions"("book_id", "ended_at");

-- AddForeignKey
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reading_sessions" ADD CONSTRAINT "reading_sessions_book_id_fkey" FOREIGN KEY ("book_id") REFERENCES "books"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- RenameIndex
ALTER INDEX "idx_ambients_book_id" RENAME TO "ambients_book_id_idx";

-- RenameIndex
ALTER INDEX "idx_books_position" RENAME TO "books_user_id_position_idx";

-- RenameIndex
ALTER INDEX "idx_books_user_id" RENAME TO "books_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_chapters_book_id" RENAME TO "chapters_book_id_idx";

-- RenameIndex
ALTER INDEX "idx_chapters_position" RENAME TO "chapters_book_id_position_idx";

-- RenameIndex
ALTER INDEX "idx_reading_fonts_user_id" RENAME TO "reading_fonts_user_id_idx";

-- RenameIndex
ALTER INDEX "idx_reading_progress_user_book" RENAME TO "reading_progress_user_id_book_id_idx";

-- AlterTable
ALTER TABLE "books" ADD COLUMN "slug" VARCHAR(100);

-- CreateIndex
CREATE UNIQUE INDEX "books_user_id_slug_key" ON "books"("user_id", "slug");

-- AlterTable: add username and bio to users
ALTER TABLE "users" ADD COLUMN "username" VARCHAR(40);
ALTER TABLE "users" ADD COLUMN "bio" VARCHAR(500);

-- CreateIndex: unique username
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- AlterTable: add visibility, description, published_at to books
ALTER TABLE "books" ADD COLUMN "visibility" VARCHAR(20) NOT NULL DEFAULT 'draft';
ALTER TABLE "books" ADD COLUMN "description" VARCHAR(2000);
ALTER TABLE "books" ADD COLUMN "published_at" TIMESTAMPTZ;

-- CreateIndex: for public book listing (published books sorted by date)
CREATE INDEX "books_visibility_published_at_idx" ON "books"("visibility", "published_at");

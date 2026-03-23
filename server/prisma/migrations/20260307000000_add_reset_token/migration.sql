-- AlterTable
ALTER TABLE "users" ADD COLUMN "reset_token" VARCHAR(255),
ADD COLUMN "reset_token_expires_at" TIMESTAMPTZ;

-- CreateIndex
CREATE UNIQUE INDEX "users_reset_token_key" ON "users"("reset_token");

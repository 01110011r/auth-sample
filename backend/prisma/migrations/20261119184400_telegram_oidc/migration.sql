ALTER TABLE "users"
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN "phone_number" TEXT;

CREATE UNIQUE INDEX "users_phone_number_key"
  ON "users"("phone_number");

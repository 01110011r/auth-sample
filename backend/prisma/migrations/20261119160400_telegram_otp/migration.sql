CREATE TABLE "telegram_otp_challenges" (
    "id" TEXT NOT NULL,
    "telegram_id" TEXT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_otp_challenges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "telegram_otp_challenges_otp_hash_key"
  ON "telegram_otp_challenges"("otp_hash");
CREATE INDEX "telegram_otp_challenges_telegram_id_idx"
  ON "telegram_otp_challenges"("telegram_id");
CREATE INDEX "telegram_otp_challenges_expires_at_idx"
  ON "telegram_otp_challenges"("expires_at");

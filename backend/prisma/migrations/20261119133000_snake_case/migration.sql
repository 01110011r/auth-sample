ALTER TYPE "AuthProvider" RENAME TO "auth_provider";

ALTER TYPE "auth_provider" RENAME VALUE 'LOCAL' TO 'local';
ALTER TYPE "auth_provider" RENAME VALUE 'GOOGLE' TO 'google';
ALTER TYPE "auth_provider" RENAME VALUE 'FACEBOOK' TO 'facebook';
ALTER TYPE "auth_provider" RENAME VALUE 'TELEGRAM' TO 'telegram';

ALTER TABLE "User" RENAME TO "users";
ALTER TABLE "SocialAccount" RENAME TO "social_accounts";
ALTER TABLE "RefreshToken" RENAME TO "refresh_tokens";
ALTER TABLE "PasswordResetToken" RENAME TO "password_reset_tokens";
ALTER TABLE "EmailVerificationToken" RENAME TO "email_verification_tokens";

ALTER TABLE "users" RENAME COLUMN "passwordHash" TO "password_hash";
ALTER TABLE "users" RENAME COLUMN "avatarUrl" TO "avatar_url";
ALTER TABLE "users" RENAME COLUMN "emailVerified" TO "email_verified";
ALTER TABLE "users" RENAME COLUMN "createdAt" TO "created_at";
ALTER TABLE "users" RENAME COLUMN "updatedAt" TO "updated_at";

ALTER TABLE "social_accounts" RENAME COLUMN "providerId" TO "provider_id";
ALTER TABLE "social_accounts" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "social_accounts" RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "refresh_tokens" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "refresh_tokens" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "refresh_tokens" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "refresh_tokens" RENAME COLUMN "revokedAt" TO "revoked_at";
ALTER TABLE "refresh_tokens" RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "password_reset_tokens" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "usedAt" TO "used_at";
ALTER TABLE "password_reset_tokens" RENAME COLUMN "createdAt" TO "created_at";

ALTER TABLE "email_verification_tokens" RENAME COLUMN "tokenHash" TO "token_hash";
ALTER TABLE "email_verification_tokens" RENAME COLUMN "userId" TO "user_id";
ALTER TABLE "email_verification_tokens" RENAME COLUMN "expiresAt" TO "expires_at";
ALTER TABLE "email_verification_tokens" RENAME COLUMN "usedAt" TO "used_at";
ALTER TABLE "email_verification_tokens" RENAME COLUMN "createdAt" TO "created_at";

ALTER INDEX "User_email_key" RENAME TO "users_email_key";
ALTER INDEX "SocialAccount_provider_providerId_key" RENAME TO "social_accounts_provider_provider_id_key";
ALTER INDEX "RefreshToken_tokenHash_key" RENAME TO "refresh_tokens_token_hash_key";
ALTER INDEX "PasswordResetToken_tokenHash_key" RENAME TO "password_reset_tokens_token_hash_key";
ALTER INDEX "EmailVerificationToken_tokenHash_key" RENAME TO "email_verification_tokens_token_hash_key";

ALTER TABLE "social_accounts"
  RENAME CONSTRAINT "SocialAccount_userId_fkey" TO "social_accounts_user_id_fkey";
ALTER TABLE "refresh_tokens"
  RENAME CONSTRAINT "RefreshToken_userId_fkey" TO "refresh_tokens_user_id_fkey";
ALTER TABLE "password_reset_tokens"
  RENAME CONSTRAINT "PasswordResetToken_userId_fkey" TO "password_reset_tokens_user_id_fkey";
ALTER TABLE "email_verification_tokens"
  RENAME CONSTRAINT "EmailVerificationToken_userId_fkey" TO "email_verification_tokens_user_id_fkey";

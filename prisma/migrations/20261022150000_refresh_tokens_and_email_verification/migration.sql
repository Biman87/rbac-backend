-- Migration: Add RefreshToken model + email verification + password reset fields on User

-- Step 1 — Add new nullable columns to users
ALTER TABLE "users"
  ADD COLUMN "isEmailVerified"          BOOLEAN,
  ADD COLUMN "emailVerificationToken"   TEXT,
  ADD COLUMN "emailVerificationExpires" TIMESTAMP(3),
  ADD COLUMN "passwordResetToken"       TEXT,
  ADD COLUMN "passwordResetExpires"     TIMESTAMP(3);

-- Step 2 — Backfill: existing users are treated as already-verified
--          (they were created before verification existed)
UPDATE "users" SET "isEmailVerified" = true;

-- Step 3 — Enforce NOT NULL + default on isEmailVerified
ALTER TABLE "users" ALTER COLUMN "isEmailVerified" SET NOT NULL;
ALTER TABLE "users" ALTER COLUMN "isEmailVerified" SET DEFAULT false;

-- Step 4 — Unique indexes on token columns (sparse — only applies when not NULL)
CREATE UNIQUE INDEX "users_emailVerificationToken_key" ON "users"("emailVerificationToken");
CREATE UNIQUE INDEX "users_passwordResetToken_key"     ON "users"("passwordResetToken");

-- Step 5 — Create refresh_tokens table
CREATE TABLE "refresh_tokens" (
    "id"        TEXT        NOT NULL,
    "token"     TEXT        NOT NULL,   -- SHA-256 hash of the raw token
    "userId"    TEXT        NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

ALTER TABLE "refresh_tokens"
    ADD CONSTRAINT "refresh_tokens_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

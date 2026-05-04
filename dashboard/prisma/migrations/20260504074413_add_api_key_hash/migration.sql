-- Migration: add_api_key_hash
--
-- Adds a keyHash column (SHA-256 hex of the raw API key) to ApiKey.
-- The plaintext `key` column is kept for backward compatibility during the
-- transition period. Once all existing keys have been backfilled (via the
-- opportunistic backfill in validateApiKey) and all clients have rotated to
-- new hashed keys, drop the `key` column with a follow-up migration.
--
-- Backfill existing rows so the hash index is populated immediately:
--   UPDATE "ApiKey" SET "keyHash" = encode(sha256(key::bytea), 'hex') WHERE "keyHash" IS NULL;
-- (Run this manually in Supabase SQL editor after applying the migration.)

ALTER TABLE "ApiKey" ADD COLUMN "keyHash" TEXT;

CREATE UNIQUE INDEX "ApiKey_keyHash_key" ON "ApiKey"("keyHash");

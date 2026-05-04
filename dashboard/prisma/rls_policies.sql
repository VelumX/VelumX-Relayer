-- ============================================================
-- VelumX Row Level Security Policies
-- Run this in: Supabase Dashboard → SQL Editor
-- ============================================================
--
-- IMPORTANT: Your app uses Prisma (postgres role via DATABASE_URL)
-- which bypasses RLS by default — so this does NOT affect your app.
-- These policies protect against direct Supabase API access using
-- the anon or authenticated role (e.g. someone using your anon key
-- directly against the REST/GraphQL API).
-- ============================================================

-- ── Enable RLS on all tables ─────────────────────────────────

ALTER TABLE "ApiKey"      ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Transaction"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "UsageLog"    ENABLE ROW LEVEL SECURITY;

-- ── ApiKey policies ──────────────────────────────────────────

CREATE POLICY "apikey_select_own" ON "ApiKey"
  FOR SELECT TO authenticated
  USING (auth.uid()::text = "userId");

CREATE POLICY "apikey_insert_own" ON "ApiKey"
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "apikey_update_own" ON "ApiKey"
  FOR UPDATE TO authenticated
  USING  (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "apikey_delete_own" ON "ApiKey"
  FOR DELETE TO authenticated
  USING (auth.uid()::text = "userId");

-- Anon role gets nothing
CREATE POLICY "apikey_deny_anon" ON "ApiKey"
  FOR ALL TO anon
  USING (false);

-- ── Transaction policies ─────────────────────────────────────

CREATE POLICY "transaction_select_own" ON "Transaction"
  FOR SELECT TO authenticated
  USING (auth.uid()::text = "userId");

CREATE POLICY "transaction_insert_own" ON "Transaction"
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "transaction_update_own" ON "Transaction"
  FOR UPDATE TO authenticated
  USING  (auth.uid()::text = "userId")
  WITH CHECK (auth.uid()::text = "userId");

CREATE POLICY "transaction_deny_anon" ON "Transaction"
  FOR ALL TO anon
  USING (false);

-- ── UsageLog policies ─────────────────────────────────────────
-- Internal table — no direct access via Supabase API at all

CREATE POLICY "usagelog_deny_authenticated" ON "UsageLog"
  FOR ALL TO authenticated
  USING (false);

CREATE POLICY "usagelog_deny_anon" ON "UsageLog"
  FOR ALL TO anon
  USING (false);

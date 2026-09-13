-- Durable COD checkout idempotency + user upsert support for shopify_order_links
-- submission_id is unique per user (not globally), so ownership stays user-scoped.
ALTER TABLE shopify_order_links
  ADD COLUMN IF NOT EXISTS submission_id TEXT;

DROP INDEX IF EXISTS idx_shopify_order_links_submission;

CREATE UNIQUE INDEX IF NOT EXISTS idx_shopify_order_links_user_submission
  ON shopify_order_links (supabase_user_id, submission_id)
  WHERE submission_id IS NOT NULL;

DROP POLICY IF EXISTS "Users update own order links" ON shopify_order_links;
CREATE POLICY "Users update own order links" ON shopify_order_links
  FOR UPDATE
  USING (auth.uid() = supabase_user_id)
  WITH CHECK (auth.uid() = supabase_user_id);

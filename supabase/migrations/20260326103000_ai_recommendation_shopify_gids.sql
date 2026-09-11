-- Phase 2: AI / survey recommendation Shopify GID support
-- Additive only — does NOT drop products, orders, order_items, order_tracking, combos, combo_products

-- Explicit item snapshots for personalized recommendations (Shopify GIDs)
ALTER TABLE personalized_combos
  ADD COLUMN IF NOT EXISTS recommendation_items JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN personalized_combos.recommendation_items IS
  'Array of { shopify_product_id, shopify_variant_id, name, price, handle, image_url, reason }. Legacy UUID product_id may appear in older ai_recommendation JSON only.';

-- AI combos: store Shopify line references without using combo_products UUID FKs
ALTER TABLE combos
  ADD COLUMN IF NOT EXISTS shopify_items JSONB DEFAULT NULL;

COMMENT ON COLUMN combos.shopify_items IS
  'For is_ai_generated combos: [{ shopify_product_id, shopify_variant_id, name, price, handle, image_url }]. Curated purchasable bundles remain Shopify products; combo_products UUID links are legacy.';

-- Optional survey link convenience index
CREATE INDEX IF NOT EXISTS idx_personalized_combos_user_created
  ON personalized_combos (user_id, created_at DESC);

-- Phase 3: Admin curated combos + analytics — additive only
-- Does NOT drop products, combo_products, orders, order_items, order_tracking

-- Document / ensure shopify_items is the active curated combo commerce reference
COMMENT ON COLUMN combos.shopify_items IS
  'Active combo line references for curated + AI combos. Shape: [{ shopify_product_id, shopify_variant_id, quantity, name?, price?, handle?, image_url? }]. Display fields are non-authoritative snapshots; Shopify remains SOT for price/inventory. Legacy combo_products UUID rows are retained for history only.';

-- Optional analytics/cost helper already exists as layali_product_costs (Phase 1).
-- Ensure updated_at trigger helper column stays present (no-op if exists).
ALTER TABLE combos
  ADD COLUMN IF NOT EXISTS shopify_items JSONB DEFAULT NULL;

-- Index for querying curated Shopify-backed combos
CREATE INDEX IF NOT EXISTS idx_combos_shopify_items_gin
  ON combos USING GIN (shopify_items)
  WHERE shopify_items IS NOT NULL;

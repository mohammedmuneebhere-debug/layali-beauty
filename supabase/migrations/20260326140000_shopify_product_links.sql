-- Idempotent Supabase → Shopify product migration mapping
-- Additive only. Does NOT modify or drop public.products.

CREATE TABLE IF NOT EXISTS shopify_product_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT shopify_product_links_supabase_product_id_key UNIQUE (supabase_product_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_product_links_shopify_product
  ON shopify_product_links (shopify_product_id);

COMMENT ON TABLE shopify_product_links IS
  'Maps legacy Supabase products.id to Shopify product/variant GIDs. Used for idempotent catalog migration. Does not replace products.';

ALTER TABLE shopify_product_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read product links" ON shopify_product_links;
CREATE POLICY "Admins read product links" ON shopify_product_links
  FOR SELECT USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage product links" ON shopify_product_links;
CREATE POLICY "Admins manage product links" ON shopify_product_links
  FOR ALL USING (public.is_admin());

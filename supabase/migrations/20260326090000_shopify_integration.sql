-- Additive Shopify integration tables (DO NOT DROP old commerce tables yet)
-- Run in Supabase SQL Editor after reviewing.

-- Layali-specific product metadata keyed by Shopify GIDs
CREATE TABLE IF NOT EXISTS layali_product_metadata (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_product_id TEXT NOT NULL UNIQUE,
  shopify_variant_id TEXT,
  gender gender_type,
  beauty_attributes TEXT[] DEFAULT '{}',
  ai_tags TEXT[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_layali_product_metadata_product
  ON layali_product_metadata (shopify_product_id);

-- Regional availability keyed by Shopify product GID
CREATE TABLE IF NOT EXISTS layali_product_regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_product_id TEXT NOT NULL,
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  is_available BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (shopify_product_id, region_id)
);

CREATE INDEX IF NOT EXISTS idx_layali_product_regions_region
  ON layali_product_regions (region_id, is_available);

CREATE INDEX IF NOT EXISTS idx_layali_product_regions_product
  ON layali_product_regions (shopify_product_id);

-- Internal COGS keyed by Shopify IDs (not deprecated products.cost_price)
CREATE TABLE IF NOT EXISTS layali_product_costs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shopify_product_id TEXT NOT NULL,
  shopify_variant_id TEXT,
  cost_price DECIMAL(10, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'SAR',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_layali_product_costs_variant
  ON layali_product_costs (shopify_product_id, COALESCE(shopify_variant_id, ''));

-- Lightweight mapping: Supabase user ↔ Shopify order (no line-item duplication)
CREATE TABLE IF NOT EXISTS shopify_order_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  supabase_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  shopify_order_id TEXT NOT NULL,
  shopify_order_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (shopify_order_id)
);

CREATE INDEX IF NOT EXISTS idx_shopify_order_links_user
  ON shopify_order_links (supabase_user_id);

-- Trending: add Shopify product GID column (keep product_id during dual-read period)
ALTER TABLE trending_products
  ADD COLUMN IF NOT EXISTS shopify_product_id TEXT;

-- Allow rows keyed only by Shopify GID (product_id becomes optional during migration)
ALTER TABLE trending_products
  ALTER COLUMN product_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_trending_shopify_product
  ON trending_products (shopify_product_id)
  WHERE shopify_product_id IS NOT NULL;

-- Optional Shopify customer mapping on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS shopify_customer_id TEXT;

-- RLS
ALTER TABLE layali_product_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE layali_product_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE layali_product_costs ENABLE ROW LEVEL SECURITY;
ALTER TABLE shopify_order_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read product metadata" ON layali_product_metadata;
CREATE POLICY "Public read product metadata" ON layali_product_metadata
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins manage product metadata" ON layali_product_metadata;
CREATE POLICY "Admins manage product metadata" ON layali_product_metadata
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Public read product regions" ON layali_product_regions;
CREATE POLICY "Public read product regions" ON layali_product_regions
  FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Admins manage product regions" ON layali_product_regions;
CREATE POLICY "Admins manage product regions" ON layali_product_regions
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins manage product costs" ON layali_product_costs;
CREATE POLICY "Admins manage product costs" ON layali_product_costs
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Users read own order links" ON shopify_order_links;
CREATE POLICY "Users read own order links" ON shopify_order_links
  FOR SELECT USING (auth.uid() = supabase_user_id);

DROP POLICY IF EXISTS "Users insert own order links" ON shopify_order_links;
CREATE POLICY "Users insert own order links" ON shopify_order_links
  FOR INSERT WITH CHECK (auth.uid() = supabase_user_id);

DROP POLICY IF EXISTS "Admins manage order links" ON shopify_order_links;
CREATE POLICY "Admins manage order links" ON shopify_order_links
  FOR ALL USING (public.is_admin());

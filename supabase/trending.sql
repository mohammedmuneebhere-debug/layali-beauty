-- Trending products for the home page carousel (max 8 curated by admin)
-- Run in Supabase SQL Editor

CREATE TABLE trending_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(product_id)
);

CREATE INDEX idx_trending_products_order ON trending_products (is_active, sort_order);

ALTER TABLE trending_products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active trending products" ON trending_products
  FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Admins can manage trending products" ON trending_products
  FOR ALL USING (public.is_admin());

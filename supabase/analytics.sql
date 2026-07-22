-- Cost / profit tracking for analytics
-- Run in Supabase SQL Editor after schema.sql

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2);

ALTER TABLE combos
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2);

ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS cost_price DECIMAL(10, 2);

COMMENT ON COLUMN products.cost_price IS 'Wholesale / COGS per unit (SAR) — admin only';
COMMENT ON COLUMN combos.cost_price IS 'Wholesale / COGS per combo (SAR) — admin only';
COMMENT ON COLUMN order_items.cost_price IS 'COGS snapshot at purchase time (SAR)';

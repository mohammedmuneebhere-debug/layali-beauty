-- Fixed delivery fee column on orders (20 SAR per order)
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS delivery_fee DECIMAL(10, 2) DEFAULT 20.00;

COMMENT ON COLUMN orders.delivery_fee IS 'Fixed delivery charge per order (SAR)';

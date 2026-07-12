-- Optional: Assign all existing products to all active regions
-- Run this if you already have products without region assignments

INSERT INTO product_regions (product_id, region_id, is_available)
SELECT p.id, r.id, true
FROM products p
CROSS JOIN regions r
WHERE r.is_active = true
ON CONFLICT (product_id, region_id) DO NOTHING;

-- Seed sample products for Layali
-- Run after schema.sql in Supabase SQL Editor

INSERT INTO products (name, description, price, compare_at_price, category, gender, benefits, stock_quantity, is_active, is_featured) VALUES
  ('Layali Rose Glow Serum', 'A luxurious vitamin C serum for radiant, even-toned skin. Perfect for all skin types.', 189.00, 249.00, 'skincare', 'female', ARRAY['brightening', 'anti-aging', 'hydrating'], 50, true, true),
  ('Layali Hydrating Face Cream', 'Deep hydration cream with hyaluronic acid for dry and combination skin.', 159.00, 199.00, 'skincare', 'female', ARRAY['hydrating', 'dryness', 'moisturizing'], 75, true, true),
  ('Layali Gentle Cleanser', 'pH-balanced gentle cleanser suitable for sensitive and oily skin.', 99.00, NULL, 'skincare', 'female', ARRAY['cleansing', 'sensitive', 'oiliness'], 100, true, false),
  ('Layali Night Repair Cream', 'Overnight repair cream with retinol for mature and dry skin. Reduces wrinkles and fine lines.', 219.00, 279.00, 'skincare', 'female', ARRAY['anti-aging', 'wrinkles', 'dryness'], 40, true, true),
  ('Layali Silk Hair Mask', 'Intensive nourishing hair mask for dry, damaged, and frizzy hair.', 149.00, 189.00, 'haircare', 'female', ARRAY['frizz', 'dryness', 'breakage'], 60, true, true),
  ('Layali Volume Shampoo', 'Volumizing shampoo for fine and thin hair. Adds body and shine.', 89.00, NULL, 'haircare', 'female', ARRAY['lack of volume', 'fine hair'], 80, true, false),
  ('Layali Eau de Parfum', 'Signature floral fragrance with notes of rose, jasmine, and amber. 50ml.', 299.00, 349.00, 'fragrance', 'female', ARRAY['floral', 'long-lasting'], 30, true, true),
  ('Layali Body Butter', 'Rich body butter with shea and cocoa butter for silky smooth skin.', 129.00, NULL, 'bodycare', 'female', ARRAY['moisturizing', 'dryness'], 55, true, false),
  ('Layali Acne Control Gel', 'Targeted treatment gel for acne-prone and oily skin.', 119.00, 149.00, 'skincare', 'female', ARRAY['acne', 'oiliness', 'large pores'], 45, true, false),
  ('Layali Curl Defining Cream', 'Defines and moisturizes curly and coily hair without crunch.', 139.00, NULL, 'haircare', 'female', ARRAY['curly', 'coily', 'frizz', 'dryness'], 50, true, false);

-- Men's products
INSERT INTO products (name, description, price, compare_at_price, category, gender, benefits, stock_quantity, is_active, is_featured) VALUES
  ('Layali Men Face Wash', 'Refreshing face wash for men with oily and combination skin.', 79.00, NULL, 'skincare', 'male', ARRAY['cleansing', 'oiliness'], 60, true, false),
  ('Layali Men Hair Pomade', 'Medium hold styling pomade for straight and wavy hair.', 99.00, 129.00, 'haircare', 'male', ARRAY['styling', 'straight', 'wavy'], 40, true, true),
  ('Layali Men Cologne', 'Bold woody fragrance for the modern man. 50ml.', 249.00, 299.00, 'fragrance', 'male', ARRAY['woody', 'long-lasting'], 25, true, true);

-- Sample combo
INSERT INTO combos (name, description, price, compare_at_price, gender, is_active, dermatologist_verified) VALUES
  ('Radiance Starter Kit', 'Everything you need to start your glow journey: Serum, Cleanser, and Face Cream.', 399.00, 497.00, 'female', true, true),
  ('Hair Revival Bundle', 'Complete hair care set: Silk Hair Mask and Volume Shampoo.', 219.00, 278.00, 'female', true, true);

-- To create an admin user, sign up normally then run:
-- UPDATE profiles SET role = 'admin' WHERE email = 'your-admin@email.com';

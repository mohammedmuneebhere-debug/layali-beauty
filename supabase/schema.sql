-- Layali E-Commerce Database Schema
-- Run this in your Supabase SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Custom types
CREATE TYPE user_role AS ENUM ('user', 'admin');
CREATE TYPE gender_type AS ENUM ('female', 'male');
CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled');
CREATE TYPE product_category AS ENUM ('skincare', 'haircare', 'fragrance', 'bodycare', 'makeup', 'combo');

-- Profiles (extends Supabase auth.users)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role user_role NOT NULL DEFAULT 'user',
  gender gender_type,
  country TEXT,
  city TEXT,
  phone TEXT,
  address TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Regions / Outlets
CREATE TABLE regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  country TEXT NOT NULL,
  city TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(country, city)
);

-- Products
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  compare_at_price DECIMAL(10, 2),
  category product_category NOT NULL,
  gender gender_type NOT NULL,
  image_url TEXT,
  images TEXT[] DEFAULT '{}',
  ingredients TEXT,
  benefits TEXT[],
  stock_quantity INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_featured BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Product availability by region
CREATE TABLE product_regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  is_available BOOLEAN DEFAULT TRUE,
  UNIQUE(product_id, region_id)
);

-- Product combos (bundles)
CREATE TABLE combos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  compare_at_price DECIMAL(10, 2),
  gender gender_type NOT NULL,
  image_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  is_ai_generated BOOLEAN DEFAULT FALSE,
  dermatologist_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Combo products junction
CREATE TABLE combo_products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combo_id UUID NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  quantity INTEGER DEFAULT 1,
  UNIQUE(combo_id, product_id)
);

-- Combo availability by region
CREATE TABLE combo_regions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  combo_id UUID NOT NULL REFERENCES combos(id) ON DELETE CASCADE,
  region_id UUID NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  is_available BOOLEAN DEFAULT TRUE,
  UNIQUE(combo_id, region_id)
);

-- Orders
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  status order_status DEFAULT 'pending',
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_method TEXT DEFAULT 'cod',
  shipping_address TEXT NOT NULL,
  shipping_city TEXT NOT NULL,
  shipping_country TEXT NOT NULL,
  phone TEXT NOT NULL,
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order items
CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  combo_id UUID REFERENCES combos(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Order status history (for tracking)
CREATE TABLE order_tracking (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  status order_status NOT NULL,
  message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Beauty survey responses
CREATE TABLE survey_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skin_type TEXT,
  hair_type TEXT,
  skin_concerns TEXT[],
  hair_concerns TEXT[],
  allergies TEXT[],
  age_range TEXT,
  lifestyle TEXT[],
  additional_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI-generated personalized combos
CREATE TABLE personalized_combos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  survey_id UUID REFERENCES survey_responses(id) ON DELETE SET NULL,
  combo_id UUID REFERENCES combos(id) ON DELETE SET NULL,
  ai_recommendation JSONB,
  dermatologist_verified BOOLEAN DEFAULT TRUE,
  dermatologist_name TEXT DEFAULT 'Dr. Layali Certified',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE personalized_combos ENABLE ROW LEVEL SECURITY;
ALTER TABLE regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_regions ENABLE ROW LEVEL SECURITY;
ALTER TABLE combo_products ENABLE ROW LEVEL SECURITY;

-- Admin check helper (avoids infinite RLS recursion)
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- Profiles policies
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admins can view all profiles" ON profiles FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update all profiles" ON profiles FOR UPDATE USING (public.is_admin());

-- Products policies (public read for active products)
CREATE POLICY "Anyone can view active products" ON products FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage products" ON products FOR ALL USING (public.is_admin());

-- Combos policies
CREATE POLICY "Anyone can view active combos" ON combos FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage combos" ON combos FOR ALL USING (public.is_admin());

-- Orders policies
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own orders" ON orders FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage all orders" ON orders FOR ALL USING (public.is_admin());

-- Order items policies
CREATE POLICY "Users can view own order items" ON order_items FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Users can create order items" ON order_items FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_items.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Admins can manage order items" ON order_items FOR ALL USING (public.is_admin());

-- Order tracking policies
CREATE POLICY "Users can view own order tracking" ON order_tracking FOR SELECT USING (
  EXISTS (SELECT 1 FROM orders WHERE orders.id = order_tracking.order_id AND orders.user_id = auth.uid())
);
CREATE POLICY "Admins can manage order tracking" ON order_tracking FOR ALL USING (public.is_admin());

-- Survey policies
CREATE POLICY "Users can manage own surveys" ON survey_responses FOR ALL USING (auth.uid() = user_id);

-- Personalized combos policies
CREATE POLICY "Users can view own personalized combos" ON personalized_combos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create personalized combos" ON personalized_combos FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Regions policies
CREATE POLICY "Anyone can view active regions" ON regions FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admins can manage regions" ON regions FOR ALL USING (public.is_admin());

-- Junction table policies
CREATE POLICY "Anyone can view product regions" ON product_regions FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage product regions" ON product_regions FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can view combo regions" ON combo_regions FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage combo regions" ON combo_regions FOR ALL USING (public.is_admin());
CREATE POLICY "Anyone can view combo products" ON combo_products FOR SELECT USING (TRUE);
CREATE POLICY "Admins can manage combo products" ON combo_products FOR ALL USING (public.is_admin());

-- Function to handle new user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role, gender, country, city, phone)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'User'),
    'user'::user_role,
    CASE
      WHEN NEW.raw_user_meta_data->>'gender' IN ('female', 'male')
      THEN (NEW.raw_user_meta_data->>'gender')::gender_type
      ELSE NULL
    END,
    NULLIF(NEW.raw_user_meta_data->>'country', ''),
    NULLIF(NEW.raw_user_meta_data->>'city', ''),
    NULLIF(NEW.raw_user_meta_data->>'phone', '')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER combos_updated_at BEFORE UPDATE ON combos FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Seed regions
INSERT INTO regions (country, city) VALUES
  ('Saudi Arabia', 'Riyadh'),
  ('Saudi Arabia', 'Jeddah'),
  ('Saudi Arabia', 'Dammam'),
  ('UAE', 'Dubai'),
  ('UAE', 'Abu Dhabi'),
  ('Kuwait', 'Kuwait City'),
  ('Qatar', 'Doha'),
  ('Bahrain', 'Manama');

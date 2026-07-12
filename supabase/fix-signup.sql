-- Run this in Supabase SQL Editor to fix signup and admin policy errors
-- Error: "Database error saving new user" + "infinite recursion detected in policy for relation profiles"

-- 1. Admin check helper (avoids infinite RLS recursion)
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

-- 2. Fix signup trigger — creates profile with all user metadata
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

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Allow users to insert their own profile (fallback)
DROP POLICY IF EXISTS "Users can insert own profile" ON profiles;
CREATE POLICY "Users can insert own profile" ON profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- 4. Fix recursive admin policies on profiles
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update all profiles" ON profiles;

CREATE POLICY "Admins can view all profiles" ON profiles
  FOR SELECT USING (public.is_admin());
CREATE POLICY "Admins can update all profiles" ON profiles
  FOR UPDATE USING (public.is_admin());

-- 5. Fix admin policies on other tables
DROP POLICY IF EXISTS "Admins can manage products" ON products;
CREATE POLICY "Admins can manage products" ON products
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage combos" ON combos;
CREATE POLICY "Admins can manage combos" ON combos
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage all orders" ON orders;
CREATE POLICY "Admins can manage all orders" ON orders
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage order items" ON order_items;
CREATE POLICY "Admins can manage order items" ON order_items
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage order tracking" ON order_tracking;
CREATE POLICY "Admins can manage order tracking" ON order_tracking
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage regions" ON regions;
CREATE POLICY "Admins can manage regions" ON regions
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage product regions" ON product_regions;
CREATE POLICY "Admins can manage product regions" ON product_regions
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage combo regions" ON combo_regions;
CREATE POLICY "Admins can manage combo regions" ON combo_regions
  FOR ALL USING (public.is_admin());

DROP POLICY IF EXISTS "Admins can manage combo products" ON combo_products;
CREATE POLICY "Admins can manage combo products" ON combo_products
  FOR ALL USING (public.is_admin());

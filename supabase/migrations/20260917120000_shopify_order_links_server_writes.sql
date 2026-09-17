-- Ownership links are a confused-deputy surface: the server uses the shop-wide
-- Shopify Admin token to read any Order GID stored here. Customers must not
-- INSERT, UPDATE, or DELETE rows. Only service-role (Layali server) writes;
-- the service role bypasses RLS. UNIQUE (shopify_order_id) remains: an
-- already-owned GID cannot be assigned to another user.

DROP POLICY IF EXISTS "Users insert own order links" ON shopify_order_links;
DROP POLICY IF EXISTS "Users update own order links" ON shopify_order_links;

-- Admins may read links in the dashboard; they must not write from the browser.
DROP POLICY IF EXISTS "Admins manage order links" ON shopify_order_links;
DROP POLICY IF EXISTS "Admins read order links" ON shopify_order_links;
CREATE POLICY "Admins read order links" ON shopify_order_links
  FOR SELECT USING (public.is_admin());

-- Keep customer SELECT of their own rows (order history).
DROP POLICY IF EXISTS "Users read own order links" ON shopify_order_links;
CREATE POLICY "Users read own order links" ON shopify_order_links
  FOR SELECT USING (auth.uid() = supabase_user_id);

-- Explicit deny for all JWT roles (anon/authenticated/admin). Service role bypasses RLS.
DROP POLICY IF EXISTS "No client inserts on order links" ON shopify_order_links;
CREATE POLICY "No client inserts on order links" ON shopify_order_links
  FOR INSERT WITH CHECK (false);

DROP POLICY IF EXISTS "No client updates on order links" ON shopify_order_links;
CREATE POLICY "No client updates on order links" ON shopify_order_links
  FOR UPDATE USING (false) WITH CHECK (false);

DROP POLICY IF EXISTS "No client deletes on order links" ON shopify_order_links;
CREATE POLICY "No client deletes on order links" ON shopify_order_links
  FOR DELETE USING (false);

REVOKE INSERT, UPDATE, DELETE ON TABLE public.shopify_order_links FROM anon, authenticated;
GRANT SELECT ON TABLE public.shopify_order_links TO authenticated;
GRANT ALL ON TABLE public.shopify_order_links TO service_role;


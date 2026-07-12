-- Run in Supabase SQL Editor to enable product & combo image uploads

-- Create public storage bucket for catalog images
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'catalog',
  'catalog',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- Public read access
DROP POLICY IF EXISTS "Public can view catalog images" ON storage.objects;
CREATE POLICY "Public can view catalog images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'catalog');

-- Admin upload / manage (requires is_admin() from fix-signup.sql)
DROP POLICY IF EXISTS "Admins can upload catalog images" ON storage.objects;
CREATE POLICY "Admins can upload catalog images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'catalog' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can update catalog images" ON storage.objects;
CREATE POLICY "Admins can update catalog images"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'catalog' AND public.is_admin());

DROP POLICY IF EXISTS "Admins can delete catalog images" ON storage.objects;
CREATE POLICY "Admins can delete catalog images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'catalog' AND public.is_admin());

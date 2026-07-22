-- Site banners & advertisements (admin-managed)
-- Run in Supabase SQL Editor after schema.sql

CREATE TYPE banner_placement AS ENUM ('landing_hero', 'shop_hero', 'promo_grid');

CREATE TABLE site_banners (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  placement banner_placement NOT NULL,
  image_url TEXT NOT NULL,
  alt_text TEXT NOT NULL DEFAULT '',
  href TEXT,
  span TEXT CHECK (span IS NULL OR span IN ('full', 'half')),
  image_width INTEGER,
  image_height INTEGER,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_site_banners_placement ON site_banners (placement, sort_order);
CREATE INDEX idx_site_banners_active ON site_banners (is_active, placement);

ALTER TABLE site_banners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active banners" ON site_banners
  FOR SELECT USING (
    is_active = TRUE
    AND (starts_at IS NULL OR starts_at <= NOW())
    AND (ends_at IS NULL OR ends_at >= NOW())
  );

CREATE POLICY "Admins can manage banners" ON site_banners
  FOR ALL USING (public.is_admin());

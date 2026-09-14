import type { Metadata } from 'next';
import HomePageClient from '@/components/home/HomePageClient';
import {
  HOME_DESCRIPTION,
  HOME_OG_DESCRIPTION,
  HOME_TITLE,
  HOME_URL,
  OG_IMAGE_PATH,
} from '@/lib/seo';
import { SITE_URL } from '@/lib/constants';
import { createClient } from '@/lib/supabase/server';
import { fetchTrendingProducts } from '@/lib/trending';
import { getCatalogProducts, isShopifyConfigured } from '@/lib/shopify';

export const metadata: Metadata = {
  title: {
    absolute: HOME_TITLE,
  },
  description: HOME_DESCRIPTION,
  alternates: {
    canonical: HOME_URL,
  },
  openGraph: {
    title: HOME_TITLE,
    description: HOME_OG_DESCRIPTION,
    url: HOME_URL,
    siteName: 'Layali',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: 'Layali — Beauty Redefined',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: HOME_TITLE,
    description: HOME_OG_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
};

const websiteJsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'WebSite',
      name: 'Layali',
      url: HOME_URL,
      description: HOME_DESCRIPTION,
      publisher: {
        '@type': 'Organization',
        name: 'Layali',
        url: HOME_URL,
      },
    },
    {
      '@type': 'Organization',
      name: 'Layali',
      url: HOME_URL,
      logo: `${SITE_URL}/logo.png`,
      description: HOME_DESCRIPTION,
    },
  ],
};

const MARQUEE_BRAND_LIMIT = 12;

function brandFromCatalogProductName(name: string): string | null {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (!tokens[0]) return null;
  if (/^dr\.?$/i.test(tokens[0]) && tokens[1]) return `${tokens[0]} ${tokens[1]}`;
  if (/^huda$/i.test(tokens[0]) && tokens[1]) return `${tokens[0]} ${tokens[1]}`;
  if (/^beauty$/i.test(tokens[0]) && /^of$/i.test(tokens[1] || '') && tokens[2]) {
    return `${tokens[0]} ${tokens[1]} ${tokens[2]}`;
  }
  if (/^make$/i.test(tokens[0]) && /^up$/i.test(tokens[1] || '') && tokens[2] && tokens[3]) {
    return `${tokens[0]} ${tokens[1]} ${tokens[2]} ${tokens[3]}`;
  }
  if (/^(la|le|the)$/i.test(tokens[0]) && tokens[1]) return `${tokens[0]} ${tokens[1]}`;
  if (/^lens$/i.test(tokens[0]) && tokens[1]) return `${tokens[0]} ${tokens[1]}`;
  if (/^anastasia$/i.test(tokens[0]) && tokens[1]) return `${tokens[0]} ${tokens[1]}`;
  return tokens[0];
}

function uniqueCatalogBrands(
  products: { vendor?: string | null; name?: string | null }[],
  limit = MARQUEE_BRAND_LIMIT
): string[] {
  const vendors: string[] = [];
  const seenVendors = new Set<string>();
  for (const product of products) {
    const vendor = product.vendor?.trim();
    if (!vendor) continue;
    const key = vendor.toLocaleLowerCase();
    if (seenVendors.has(key)) continue;
    seenVendors.add(key);
    vendors.push(vendor);
  }
  if (vendors.length >= 8) return vendors.slice(0, limit);

  const counts = new Map<string, { label: string; count: number }>();
  for (const product of products) {
    const brand = brandFromCatalogProductName(product.name || '');
    if (!brand) continue;
    const key = brand.toLocaleLowerCase();
    const current = counts.get(key);
    if (current) current.count += 1;
    else counts.set(key, { label: brand, count: 1 });
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, limit)
    .map((entry) => entry.label);
}

export default async function HomePage() {
  let heroProducts: Awaited<ReturnType<typeof fetchTrendingProducts>> = [];
  let catalogProducts: Awaited<ReturnType<typeof getCatalogProducts>> = [];
  const categoryCovers: Record<string, string> = {};
  try {
    const supabase = await createClient();
    heroProducts = await fetchTrendingProducts(supabase);
  } catch {
    heroProducts = [];
  }

  try {
    if (isShopifyConfigured()) {
      catalogProducts = await getCatalogProducts({ first: 250 });
      for (const product of [...heroProducts, ...catalogProducts]) {
        if (product.category && product.image_url && !categoryCovers[product.category]) {
          categoryCovers[product.category] = product.image_url;
        }
      }
    }
  } catch {
    // Category tiles still render without covers.
  }

  const marqueeBrands = uniqueCatalogBrands(
    catalogProducts.length > 0 ? catalogProducts : heroProducts
  );

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <HomePageClient
        heroProducts={heroProducts}
        categoryCovers={categoryCovers}
        marqueeBrands={marqueeBrands}
      />
    </>
  );
}

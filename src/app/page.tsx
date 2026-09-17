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
import { fetchActiveBanners } from '@/lib/site-banners';
import { getCatalogProducts, isShopifyConfigured } from '@/lib/shopify';
import type { BannerSlide } from '@/lib/banners';

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

export default async function HomePage() {
  let heroProducts: Awaited<ReturnType<typeof fetchTrendingProducts>> = [];
  let landingBanners: BannerSlide[] = [];
  let catalogProducts: Awaited<ReturnType<typeof getCatalogProducts>> = [];
  const categoryCovers: Record<string, string> = {};
  try {
    const supabase = await createClient();
    try {
      heroProducts = await fetchTrendingProducts(supabase);
    } catch {
      heroProducts = [];
    }
    try {
      landingBanners = await fetchActiveBanners(supabase, 'landing_hero');
    } catch {
      landingBanners = [];
    }
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

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <HomePageClient
        heroProducts={heroProducts}
        categoryCovers={categoryCovers}
        landingBanners={landingBanners}
      />
    </>
  );
}

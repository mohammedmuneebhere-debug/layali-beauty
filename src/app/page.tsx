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
import { loadShopCatalog, type ShopProduct } from '@/lib/catalog';
import { selectHomepageShelves } from '@/lib/homepage-products';
import { isStorefrontCategory } from '@/lib/shopify/category';
import { fetchTrendingProducts } from '@/lib/trending-data';
import { loadPlacementSlides } from '@/lib/content/banners';
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
  let catalogProducts: ShopProduct[] = [];
  const categoryCovers: Record<string, string> = {};
  try {
    try {
      heroProducts = await fetchTrendingProducts();
    } catch {
      heroProducts = [];
    }
    try {
      landingBanners = await loadPlacementSlides('landing_hero');
    } catch {
      landingBanners = [];
    }
    try {
      catalogProducts = (await loadShopCatalog({})).products;
    } catch {
      catalogProducts = [];
    }
  } catch {
    heroProducts = [];
  }

  const shelves = selectHomepageShelves(catalogProducts);

  for (const product of heroProducts) {
    if (
      isStorefrontCategory(product.category) &&
      product.image_url &&
      !categoryCovers[product.category]
    ) {
      categoryCovers[product.category] = product.image_url;
    }
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
        trendingProducts={shelves.trending}
        makeupProducts={shelves.makeup}
        skincareProducts={shelves.skincare}
      />
    </>
  );
}

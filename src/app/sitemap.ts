import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/constants';
import { ABOUT_URL, HOME_URL } from '@/lib/seo';
import { getCatalogProducts, isShopifyConfigured } from '@/lib/shopify';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const lastModified = new Date();

  const entries: MetadataRoute.Sitemap = [
    {
      url: HOME_URL,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${SITE_URL}/shop`,
      lastModified,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${SITE_URL}/combos`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: ABOUT_URL,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${SITE_URL}/customer-care`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
  ];

  if (isShopifyConfigured()) {
    try {
      const products = await getCatalogProducts({ first: 100 });
      for (const product of products) {
        if (!product.handle) continue;
        entries.push({
          url: `${SITE_URL}/shop/${product.handle}`,
          lastModified,
          changeFrequency: 'weekly',
          priority: 0.7,
        });
      }
    } catch (err) {
      console.error('sitemap product fetch failed', err);
    }
  }

  return entries;
}

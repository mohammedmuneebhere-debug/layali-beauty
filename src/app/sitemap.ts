import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/constants';
import { ABOUT_URL, HOME_URL } from '@/lib/seo';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return [
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
}

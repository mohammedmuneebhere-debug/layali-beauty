import type { Metadata } from 'next';
import AboutPageClient from '@/components/about/AboutPageClient';
import {
  ABOUT_DESCRIPTION,
  ABOUT_TITLE,
  ABOUT_URL,
  OG_IMAGE_PATH,
} from '@/lib/seo';

export const metadata: Metadata = {
  title: {
    absolute: ABOUT_TITLE,
  },
  description: ABOUT_DESCRIPTION,
  alternates: {
    canonical: ABOUT_URL,
  },
  openGraph: {
    title: ABOUT_TITLE,
    description: ABOUT_DESCRIPTION,
    url: ABOUT_URL,
    siteName: 'Layali',
    type: 'website',
    locale: 'en_US',
    images: [
      {
        url: OG_IMAGE_PATH,
        width: 1200,
        height: 630,
        alt: 'About Layali — Beauty & Lifestyle',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: ABOUT_TITLE,
    description: ABOUT_DESCRIPTION,
    images: [OG_IMAGE_PATH],
  },
};

export default function AboutPage() {
  return <AboutPageClient />;
}

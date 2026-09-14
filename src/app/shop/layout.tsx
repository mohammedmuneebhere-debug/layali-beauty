import type { Metadata } from 'next';
import { SHOP_DESCRIPTION, SHOP_TITLE, SHOP_URL, OG_IMAGE_PATH } from '@/lib/seo';

export const metadata: Metadata = {
  title: SHOP_TITLE,
  description: SHOP_DESCRIPTION,
  alternates: { canonical: SHOP_URL },
  openGraph: {
    title: SHOP_TITLE,
    description: SHOP_DESCRIPTION,
    url: SHOP_URL,
    images: [{ url: OG_IMAGE_PATH, width: 1200, height: 630, alt: 'Layali Shop' }],
  },
};

export default function ShopLayout({ children }: { children: React.ReactNode }) {
  return children;
}

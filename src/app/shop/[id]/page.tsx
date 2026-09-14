import type { Metadata } from 'next';
import { loadShopProductByParam } from '@/lib/catalog';
import { SITE_URL } from '@/lib/constants';
import { breadcrumbJsonLd, productCanonical, productJsonLd } from '@/lib/seo-product';
import { OG_IMAGE_PATH } from '@/lib/seo';
import { ProductDetailClient } from './ProductDetailClient';

type PageProps = {
  params: Promise<{ id: string }> | { id: string };
};

async function resolveParams(params: PageProps['params']) {
  return await params;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await resolveParams(params);
  const product = await loadShopProductByParam(decodeURIComponent(id));
  if (!product) {
    return {
      title: 'Product',
      robots: { index: false, follow: true },
    };
  }

  const url = productCanonical(product);
  const description = product.description?.slice(0, 160) || `${product.name} at Layali.`;
  const image = product.image_url || OG_IMAGE_PATH;

  return {
    title: product.name,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: product.name,
      description,
      url,
      type: 'website',
      images: [{ url: image, alt: product.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title: product.name,
      description,
      images: [image],
    },
  };
}

export default async function ProductDetailPage({ params }: PageProps) {
  const { id } = await resolveParams(params);
  const product = await loadShopProductByParam(decodeURIComponent(id));
  const jsonLd = product
    ? [
        productJsonLd(product),
        breadcrumbJsonLd([
          { name: 'Home', url: `${SITE_URL}/` },
          { name: 'Shop', url: `${SITE_URL}/shop` },
          { name: product.name, url: productCanonical(product) },
        ]),
      ]
    : null;

  return (
    <>
      {jsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      ) : null}
      <ProductDetailClient productParam={id} initialProduct={product} />
    </>
  );
}

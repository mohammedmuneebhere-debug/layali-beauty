import { SITE_URL } from '@/lib/constants';
import type { ShopProduct } from '@/lib/catalog';

export function productCanonical(product: Pick<ShopProduct, 'handle' | 'id'>) {
  return `${SITE_URL}/shop/${product.handle || product.id}`;
}

export function productJsonLd(product: ShopProduct) {
  const url = productCanonical(product);
  const images = (product.images?.length ? product.images : product.image_url ? [product.image_url] : []).filter(
    Boolean
  );

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || undefined,
    image: images.length ? images : undefined,
    sku: product.handle || product.id,
    brand: product.vendor
      ? {
          '@type': 'Brand',
          name: product.vendor,
        }
      : {
          '@type': 'Brand',
          name: 'Layali',
        },
    offers: {
      '@type': 'Offer',
      url,
      priceCurrency: 'SAR',
      price: Number(product.price),
      availability: product.available
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      itemCondition: 'https://schema.org/NewCondition',
    },
  };
}

export function breadcrumbJsonLd(items: { name: string; url: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

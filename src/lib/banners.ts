export type BannerSlide = {
  src: string;
  alt: string;
  href?: string;
};

/** Exact pixel sizes after upscale — keeps CSS aspect-ratio correct (no squash) */
export const BANNER_SIZES: Record<string, { w: number; h: number }> = {
  '/banners/calm-balance-skin.png': { w: 2400, h: 270 },
  '/banners/daily-care-routine.png': { w: 2400, h: 260 },
  '/banners/dior-beautiful-skin.png': { w: 2400, h: 804 },
  '/banners/dior-forever.png': { w: 2400, h: 721 },
  '/banners/huda-beauty-empowers.png': { w: 2400, h: 779 },
  '/banners/huda-lips.png': { w: 2400, h: 797 },
  '/banners/kbeauty-glow-confidence.png': { w: 2400, h: 307 },
  '/banners/loreal-beauty-works.png': { w: 2400, h: 793 },
  '/banners/loreal-science.png': { w: 2400, h: 476 },
  '/banners/loreal-worth-it.png': { w: 2400, h: 495 },
  '/banners/offers-grid-ar.png': { w: 2400, h: 3657 },
  '/banners/sheglam-fun-makeup.png': { w: 2400, h: 698 },
  '/banners/torriden-hydration.png': { w: 2400, h: 246 },
  // Split offer tiles (native aspect preserved)
  '/banners/offers/wide-1.png': { w: 2011, h: 524 },
  '/banners/offers/sq-1a.png': { w: 1600, h: 1892 },
  '/banners/offers/sq-1b.png': { w: 1600, h: 1604 },
  '/banners/offers/sq-2a.png': { w: 1600, h: 1606 },
  '/banners/offers/sq-2b.png': { w: 1600, h: 1606 },
  '/banners/offers/wide-2.png': { w: 3140, h: 1054 },
  '/banners/offers/sq-3a.png': { w: 1600, h: 1606 },
  '/banners/offers/sq-3b.png': { w: 1600, h: 1606 },
};

/** Landing — K-beauty / skincare rituals (best brand fit) */
export const LANDING_HERO_BANNERS: BannerSlide[] = [
  {
    src: '/banners/kbeauty-glow-confidence.png',
    alt: 'Glow with Confidence — Korean Skincare Essentials',
    href: '/shop',
  },
  {
    src: '/banners/daily-care-routine.png',
    alt: 'Daily Care, Lasting Glow — Build Your Routine',
    href: '/shop?category=skincare',
  },
  {
    src: '/banners/calm-balance-skin.png',
    alt: 'Calm. Balance. Beautiful Skin — Soothing Care',
    href: '/shop?category=skincare',
  },
  {
    src: '/banners/torriden-hydration.png',
    alt: 'Torriden DIVE-IN — Hydration That Goes Deeper',
    href: '/shop',
  },
];

export const LANDING_FEATURE_BANNERS: BannerSlide[] = [
  {
    src: '/banners/torriden-hydration.png',
    alt: 'Torriden deep hydration serum',
    href: '/shop',
  },
  {
    src: '/banners/dior-beautiful-skin.png',
    alt: 'The Art of Beautiful Skin',
    href: '/shop?category=skincare',
  },
  {
    src: '/banners/calm-balance-skin.png',
    alt: 'Soothing care for sensitive skin',
    href: '/shop?category=skincare',
  },
];

/** Shop — promotional / brand spotlight ads */
export const SHOP_HERO_BANNERS: BannerSlide[] = [
  {
    src: '/banners/kbeauty-glow-confidence.png',
    alt: 'Korean Skincare Essentials — Shop Now',
    href: '/shop?category=skincare',
  },
  {
    src: '/banners/daily-care-routine.png',
    alt: 'Build Your Skincare Routine',
    href: '/shop?category=skincare',
  },
  {
    src: '/banners/huda-beauty-empowers.png',
    alt: 'Huda Beauty — Beauty That Empowers You',
    href: '/shop?category=makeup',
  },
  {
    src: '/banners/sheglam-fun-makeup.png',
    alt: 'SHEGLAM — Fun Makeup, Seriously Good',
    href: '/shop?category=makeup',
  },
  {
    src: '/banners/dior-forever.png',
    alt: 'Dior Forever Timeless',
    href: '/shop?category=makeup',
  },
];

export const SHOP_PROMO_STRIP: BannerSlide[] = [
  {
    src: '/banners/loreal-worth-it.png',
    alt: "L'Oréal Paris — Because You're Worth It",
    href: '/shop',
  },
  {
    src: '/banners/huda-lips.png',
    alt: 'Huda Beauty Lips That Leave a Mark',
    href: '/shop?category=makeup',
  },
  {
    src: '/banners/loreal-beauty-works.png',
    alt: "L'Oréal — Beauty That Works",
    href: '/shop',
  },
  {
    src: '/banners/loreal-science.png',
    alt: "L'Oréal — Beauty Powered by Science",
    href: '/shop',
  },
];

export const SHOP_OFFERS_BANNER: BannerSlide = {
  src: '/banners/offers-grid-ar.png',
  alt: 'Limited-time beauty offers and deals',
  href: '/shop',
};

/** Marketplace offers grid — wide / 2 / 2 / wide / 2 (no crop) */
export const OFFERS_PROMO_GRID = [
  {
    src: '/banners/offers/wide-1.png',
    alt: 'Rimmel London — up to 50% off',
    href: '/shop?category=makeup',
    span: 'full' as const,
  },
  {
    src: '/banners/offers/sq-1a.png',
    alt: 'Medicube — up to 50% off',
    href: '/shop?category=skincare',
    span: 'half' as const,
  },
  {
    src: '/banners/offers/sq-1b.png',
    alt: 'ViveLab — up to 50% off',
    href: '/shop?category=skincare',
    span: 'half' as const,
  },
  {
    src: '/banners/offers/sq-2a.png',
    alt: 'Sunscreen essentials',
    href: '/shop?category=skincare',
    span: 'half' as const,
  },
  {
    src: '/banners/offers/sq-2b.png',
    alt: 'Tan essentials',
    href: '/shop?category=bodycare',
    span: 'half' as const,
  },
  {
    src: '/banners/offers/wide-2.png',
    alt: 'Buy 1 Get 1 Free on selected products',
    href: '/shop',
    span: 'full' as const,
  },
  {
    src: '/banners/offers/sq-3a.png',
    alt: 'Topface — up to 45% off',
    href: '/shop?category=makeup',
    span: 'half' as const,
  },
  {
    src: '/banners/offers/sq-3b.png',
    alt: 'Calla Makeup — up to 70% off',
    href: '/shop?category=makeup',
    span: 'half' as const,
  },
];

/** Same grid format with Layali brand banners */
export const BRAND_PROMO_GRID = [
  {
    src: '/banners/kbeauty-glow-confidence.png',
    alt: 'Glow with Confidence — Korean Skincare',
    href: '/shop',
    span: 'full' as const,
  },
  {
    src: '/banners/huda-beauty-empowers.png',
    alt: 'Huda Beauty',
    href: '/shop?category=makeup',
    span: 'half' as const,
  },
  {
    src: '/banners/sheglam-fun-makeup.png',
    alt: 'SHEGLAM',
    href: '/shop?category=makeup',
    span: 'half' as const,
  },
  {
    src: '/banners/dior-forever.png',
    alt: 'Dior Forever',
    href: '/shop?category=makeup',
    span: 'half' as const,
  },
  {
    src: '/banners/dior-beautiful-skin.png',
    alt: 'Dior Beautiful Skin',
    href: '/shop?category=skincare',
    span: 'half' as const,
  },
  {
    src: '/banners/daily-care-routine.png',
    alt: 'Daily Care, Lasting Glow',
    href: '/shop?category=skincare',
    span: 'full' as const,
  },
  {
    src: '/banners/loreal-worth-it.png',
    alt: "L'Oréal Paris",
    href: '/shop',
    span: 'half' as const,
  },
  {
    src: '/banners/huda-lips.png',
    alt: 'Huda Beauty Lips',
    href: '/shop?category=makeup',
    span: 'half' as const,
  },
];


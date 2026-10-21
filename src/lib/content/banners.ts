import { listBanners } from '@/lib/content/store';
import { slidesForPlacement } from '@/lib/site-banners';
import type { BannerPlacement } from '@/types/database';
import type { BannerSlide } from '@/lib/banners';

export async function loadPlacementSlides(placement: BannerPlacement): Promise<BannerSlide[]> {
  const rows = await listBanners();
  return slidesForPlacement(rows, placement);
}

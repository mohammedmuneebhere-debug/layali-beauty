'use client';

import { FadeIn } from '@/components/ui/FadeIn';
import { PromoArtwork } from '@/components/home/PromoArtwork';

/**
 * National Day campaign strip (Image 2).
 * Source is only 475x92 — cap width with Layali max-w-3xl so the browser
 * does not stretch a low-res chat-export PNG across the full page.
 */
export function PromoCampaignStrip() {
  return (
    <section
      className="relative overflow-x-clip py-6 sm:py-8"
      aria-label="Saudi National Day offers strip"
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <div className="mx-auto w-full max-w-3xl">
            <PromoArtwork
              src="/ads/layali-promo-national-day-strip.png"
              alt="Celebrate Saudi National Day — special offers on makeup and skincare"
              href="/shop"
              width={475}
              height={92}
              className="rounded-sm"
            />
          </div>
        </FadeIn>
      </div>
    </section>
  );
}

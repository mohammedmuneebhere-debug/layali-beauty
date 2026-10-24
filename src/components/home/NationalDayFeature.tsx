'use client';

import { FadeIn } from '@/components/ui/FadeIn';
import { PromoArtwork } from '@/components/home/PromoArtwork';

/**
 * Wide campaign banner above the Makeup section.
 * Full-width within the page container, at the artwork's own 1024×409 ratio.
 */
export function NationalDayFeature({ priority = false }: { priority?: boolean }) {
  return (
    <section
      className="relative overflow-x-clip py-14 sm:py-16 lg:py-24"
      aria-label="Beauty for a Brighter Tomorrow"
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-40 opacity-70"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 60% 80% at 50% 0%, rgba(212,46,124,0.18), transparent 70%)',
        }}
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <FadeIn>
          <PromoArtwork
            src="/ads/layali-promo-national-day-campaign.jpg"
            alt="Layali — Beauty for a Brighter Tomorrow, up to 50% off makeup and 30% off skincare"
            href="/shop"
            width={1024}
            height={409}
            priority={priority}
          />
        </FadeIn>
      </div>
    </section>
  );
}

'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CinematicVideo } from '@/components/cinematic/CinematicVideo';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import '@/components/cinematic/cinematic-hero.css';

/**
 * Framed skincare lookbook — light studio texture sits in a card
 * so it never dumps a white rectangle onto the dark stage.
 */
export function CinematicLookbook() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden">
      <div className="section-edge-fade pointer-events-none absolute inset-y-0 end-0 hidden w-[min(48%,36rem)] bg-gradient-to-l from-black/45 via-black/12 to-transparent lg:block" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 pt-6 pb-12 sm:px-6 sm:pt-8 sm:pb-16 lg:grid-cols-[minmax(16rem,24rem)_minmax(0,1fr)] lg:gap-16 lg:px-8 lg:pt-10 lg:pb-20">
        <div className="cinematic-lookbook-frame relative order-1 mx-auto aspect-[9/16] h-[min(46vh,22rem)] w-full max-w-[15.5rem] sm:max-w-[17.5rem] lg:mx-0 lg:h-[min(56vh,28rem)] lg:max-w-[22rem]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cinematic/hero-serum-poster.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover object-[50%_55%]"
            draggable={false}
          />
          <CinematicVideo
            sources={[{ src: '/cinematic/hero-serum.mp4', type: 'video/mp4' }]}
            poster="/cinematic/hero-serum-poster.jpg"
            width={480}
            height={854}
            className="absolute inset-0 object-[50%_55%]"
          />
        </div>

        <div className="order-2 max-w-md lg:justify-self-start">
          <p className="text-meta mb-3 uppercase tracking-[0.18em] text-layali-gold-light">
            {t.serum.eyebrow}
          </p>
          <h2 className="font-serif text-heading-lg mb-4 text-white">{t.serum.title}</h2>
          <p className="text-body-lg mb-7 max-w-sm text-white/70">{t.serum.body}</p>
          <Link
            href="/shop?category=skincare"
            prefetch
            className="text-nav inline-flex items-center gap-2 uppercase tracking-[0.12em] text-white/85 transition-colors hover:text-layali-pink-light"
          >
            {t.serum.cta} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>
      </div>
    </section>
  );
}

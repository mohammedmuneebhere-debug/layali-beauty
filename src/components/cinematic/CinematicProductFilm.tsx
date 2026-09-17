'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { CinematicVideo } from '@/components/cinematic/CinematicVideo';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import '@/components/cinematic/cinematic-hero.css';

/**
 * Editorial fragrance chapter after the shop path.
 * Lighten-blends the clip so its black field dissolves into the stage.
 */
export function CinematicProductFilm() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden">
      <div className="section-edge-fade pointer-events-none absolute inset-y-0 start-0 hidden w-[min(52%,38rem)] bg-gradient-to-r from-black/50 via-black/18 to-transparent lg:block" />

      <div className="relative mx-auto grid max-w-7xl items-center gap-8 px-4 py-10 sm:gap-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,26rem)] lg:gap-12 lg:px-8 lg:pt-16 lg:pb-10">
        <div className="order-2 max-w-md lg:order-1">
          <p className="text-meta mb-3 uppercase tracking-[0.18em] text-layali-gold-light">
            {t.film.eyebrow}
          </p>
          <h2 className="font-serif text-heading-lg mb-4 text-white">{t.film.title}</h2>
          <p className="text-body-lg mb-7 max-w-sm text-white/70">{t.film.body}</p>
          <Link
            href="/shop?category=fragrance"
            prefetch
            className="text-nav inline-flex items-center gap-2 uppercase tracking-[0.12em] text-white/85 transition-colors hover:text-layali-pink-light"
          >
            {t.film.cta} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
          </Link>
        </div>

        <div className="cinematic-video-blend cinematic-film-mask relative order-1 mx-auto aspect-[9/16] h-[min(46vh,22rem)] w-full max-w-[15.5rem] sm:max-w-[18rem] lg:order-2 lg:mx-0 lg:h-[min(58vh,32rem)] lg:max-w-[24rem] lg:justify-self-end">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/cinematic/hero-fragrance-poster.jpg"
            alt=""
            className="absolute inset-0 h-full w-full origin-[50%_42%] scale-[1.18] object-cover object-[50%_42%]"
            draggable={false}
          />
          <CinematicVideo
            sources={[{ src: '/cinematic/hero-fragrance.mp4', type: 'video/mp4' }]}
            poster="/cinematic/hero-fragrance-poster.jpg"
            width={480}
            height={864}
            className="absolute inset-0 origin-[50%_42%] scale-[1.18] object-[50%_42%]"
          />
        </div>
      </div>
    </section>
  );
}

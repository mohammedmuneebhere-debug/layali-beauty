'use client';

import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Sparkles, Droplets, Leaf } from 'lucide-react';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/FadeIn';
import { RitualCarousel } from '@/components/home/RitualCarousel';
import { DynamicBannerCarousel } from '@/components/banners/DynamicBanners';
import { HeroStage } from '@/components/home/HeroStage';
import { CinematicVideo } from '@/components/cinematic/CinematicVideo';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { STOREFRONT_NAV_CATEGORIES } from '@/lib/constants';
import type { CatalogProduct } from '@/lib/shopify/normalize';
import type { BannerSlide } from '@/lib/banners';
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion';

const CinematicProductFilm = dynamic(() =>
  import('@/components/cinematic/CinematicProductFilm').then((m) => ({
    default: m.CinematicProductFilm,
  }))
);
const CinematicLookbook = dynamic(() =>
  import('@/components/cinematic/CinematicLookbook').then((m) => ({
    default: m.CinematicLookbook,
  }))
);

const CATEGORY_IMAGES: Record<string, string> = {
  makeup: '/categories/makeup.jpg',
  skincare: '/categories/skincare.jpg',
  haircare: '/categories/haircare.jpg',
  bodycare: '/categories/body-care.jpg',
  fragrance: '/categories/fragrance.jpg',
  lenses: '/categories/lenses.jpg',
};

const CATEGORY_FILMS: Record<string, { src: string; poster: string; object: string }> = {
  makeup: {
    src: '/cinematic/hero-sponge.mp4',
    poster: '/cinematic/hero-sponge-poster.jpg',
    object: 'object-[50%_42%]',
  },
  haircare: {
    src: '/cinematic/hero-hair.mp4',
    poster: '/cinematic/hero-hair-poster.jpg',
    object: 'object-center',
  },
  bodycare: {
    src: '/cinematic/hero-body.mp4',
    poster: '/cinematic/hero-body-poster.jpg',
    object: 'object-[50%_28%]',
  },
  fragrance: {
    src: '/cinematic/category-fragrance.mp4',
    poster: '/cinematic/category-fragrance-poster.jpg',
    object: 'object-center',
  },
  skincare: {
    src: '/cinematic/category-skincare.mp4',
    poster: '/cinematic/category-skincare-poster.jpg',
    object: 'object-[50%_32%]',
  },
};

export default function HomePageClient({
  heroProducts = [],
  categoryCovers = {},
  landingBanners = [],
}: {
  heroProducts?: CatalogProduct[];
  categoryCovers?: Record<string, string>;
  landingBanners?: BannerSlide[];
}) {
  const { t } = useLanguage();
  const reduceMotion = usePrefersReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ['start start', 'end start'],
  });
  const yGlow = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const opacity = useTransform(scrollYProgress, [0, 0.75], [1, 0]);

  const features = [
    { icon: Droplets, ...t.why.glass },
    { icon: Leaf, ...t.why.authentic },
    { icon: Sparkles, ...t.why.personal },
  ];

  const categories = STOREFRONT_NAV_CATEGORIES.map((cat) => ({
    key: cat.value,
    label:
      (t.categories[cat.value as keyof typeof t.categories] as string | undefined) || cat.label,
    href: cat.value,
  }));

  return (
    <div className="page-shell text-white">
      {/* Hero — concept UI */}
      <section
        ref={heroRef}
        className="relative min-h-[100svh] overflow-hidden pt-16 lg:pt-20"
      >
        <motion.div style={reduceMotion ? undefined : { y: yGlow }} className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="glow-orb w-[50vw] h-[50vw] max-w-[560px] max-h-[560px] left-[-8%] top-[20%] opacity-45" />
          <div className="glow-orb w-[28vw] h-[28vw] max-w-[320px] max-h-[320px] right-[-5%] bottom-[15%] opacity-25" />
        </motion.div>

        <motion.div
          style={reduceMotion ? undefined : { opacity }}
          className="relative z-10 min-h-[calc(100svh-4rem)] lg:min-h-[calc(100svh-5rem)]"
        >
          <HeroStage />
          <div className="hero-copy-shade pointer-events-none absolute inset-y-0 start-0 z-[2] hidden w-[min(52%,40rem)] bg-gradient-to-r from-black via-black/75 to-transparent lg:block" />
          <div className="relative z-10 mx-auto flex min-h-[calc(100svh-4rem)] w-full max-w-7xl flex-col justify-start px-4 pt-5 pb-36 sm:px-6 lg:min-h-[calc(100svh-5rem)] lg:justify-center lg:px-8 lg:py-24 lg:pb-24">
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.85 }}
              className="relative z-10 max-w-2xl"
            >
              {t.hero.eyebrow ? (
                <p className="text-meta tracking-[0.18em] text-layali-gold-light mb-2.5 lg:mb-6 uppercase">
                  {t.hero.eyebrow}
                </p>
              ) : null}
              <h1 className="font-serif text-hero max-lg:!text-[1.875rem] max-lg:!leading-[1.08] text-white mb-0.5 lg:mb-1">{t.hero.titleBeauty}</h1>
              <p className="font-serif text-hero max-lg:!text-[1.875rem] max-lg:!leading-[1.08] text-layali-pink-light mb-3 lg:mb-6">{t.hero.titleRedefined}</p>
              <p className="text-body-lg max-lg:!text-[0.8125rem] max-lg:!leading-snug text-white/70 max-w-md mb-5 lg:mb-10">{t.hero.subtitle}</p>
              <div className="flex flex-wrap items-center gap-3 lg:gap-5">
                <Link
                  href="/shop"
                  prefetch
                  className="inline-flex w-auto items-center justify-center gap-2 rounded-full font-medium uppercase transition-all duration-300 px-5 py-2 text-[0.7rem] tracking-[0.08em] lg:px-8 lg:py-3.5 lg:text-nav lg:tracking-[0.1em] bg-layali-pink-glow text-white hover:bg-layali-pink shadow-[0_0_20px_rgba(212,46,124,0.35)] btn-glow"
                >
                  {t.hero.shopCta} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                </Link>
                <Link
                  href="/survey"
                  prefetch
                  className="text-[0.7rem] tracking-[0.1em] lg:text-nav lg:tracking-[0.12em] uppercase text-white/80 hover:text-layali-pink-light transition-colors"
                >
                  {t.hero.ritualCta}
                </Link>
              </div>
            </motion.div>
          </div>
        </motion.div>

        <div className="absolute bottom-5 lg:bottom-8 inset-x-0 flex justify-center">
          <motion.p
            animate={reduceMotion ? undefined : { opacity: [0.35, 0.8, 0.35], y: [0, 4, 0] }}
            transition={reduceMotion ? undefined : { duration: 2.2, repeat: Infinity }}
            className="text-meta tracking-[0.2em] uppercase text-white/50"
          >
            {t.hero.scroll} ↓
          </motion.p>
        </div>
      </section>

      {/* Shop by Category — Charlotte Tilbury / Ounass: merch path sits on the hero */}
      <section className="relative pt-12 pb-6 sm:pt-16 sm:pb-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="mb-6 sm:mb-8 flex items-end justify-between gap-6">
            <h2 className="font-serif text-heading-lg text-white">{t.categories.title}</h2>
            <Link
              href="/shop"
              prefetch
              className="hidden sm:inline-flex items-center gap-2 text-nav uppercase tracking-[0.12em] text-white/70 transition-colors hover:text-layali-pink-light"
            >
              {t.footer.allProducts} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
            </Link>
          </FadeIn>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {categories.map((cat, i) => {
              const film = CATEGORY_FILMS[cat.href];
              const cover =
                film?.poster ||
                CATEGORY_IMAGES[cat.href] ||
                categoryCovers[cat.href] ||
                heroProducts.find((p) => p.category === cat.href && p.image_url)?.image_url;
              return (
              <FadeIn key={cat.key} delay={i * 0.08}>
                <Link
                  href={`/shop?category=${cat.href}`}
                  className="block focus-ring rounded-2xl"
                >
                  <div className="aspect-[4/5] lg:aspect-[3/4] rounded-2xl bg-black/55 border border-layali-pink/25 flex items-end justify-start card-hover relative overflow-hidden group">
                    {cover ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={cover}
                        alt=""
                        className={`absolute inset-0 h-full w-full object-cover opacity-70 transition-transform duration-500 group-hover:scale-105 ${film?.object || ''}`}
                      />
                    ) : null}
                    {film ? (
                      <CinematicVideo
                        sources={[{ src: film.src, type: 'video/mp4' }]}
                        poster={film.poster}
                        className={`absolute inset-0 opacity-80 transition-transform duration-500 group-hover:scale-105 ${film.object}`}
                      />
                    ) : null}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <span className="relative px-3 pb-3 font-serif text-sm sm:text-heading-sm text-white">
                      {cat.label}
                    </span>
                  </div>
                </Link>
              </FadeIn>
              );
            })}
          </div>
        </div>
      </section>

      {/* Why Layali — right after categories */}
      <section className="relative overflow-x-clip py-12 sm:py-16">
        <div className="glow-orb w-[400px] h-[400px] -right-32 top-0 opacity-50" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="mb-8 lg:mb-10">
            <h2 className="font-serif text-heading-lg text-white mb-3">{t.why.title}</h2>
            <p className="text-body-lg text-white/60 max-w-2xl">{t.why.subtitle}</p>
          </FadeIn>

          <StaggerContainer className="grid md:grid-cols-3 gap-4 lg:gap-5">
            {features.map((feature) => (
              <StaggerItem key={feature.title}>
                <div className="h-full rounded-2xl border border-layali-pink/20 bg-black/55 p-6 text-start card-hover sm:p-7">
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-full border border-layali-pink/40 bg-layali-pink-glow/20 shadow-[0_0_20px_rgba(212,46,124,0.25)]">
                    <feature.icon className="h-6 w-6 text-layali-pink-light" />
                  </div>
                  <h3 className="font-serif text-heading-sm text-white mb-3">{feature.title}</h3>
                  <p className="text-body text-white/55">{feature.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      <RitualCarousel initialProducts={heroProducts} />

      {/* Find Your Ritual — after trending */}
      <section className="relative overflow-x-clip py-14 sm:py-16 lg:py-20">
        <div
          className="glow-orb w-[600px] h-[600px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-55"
          aria-hidden
        />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <FadeIn>
            <p className="font-script text-script-xl text-layali-pink-light mb-4 scale-75 origin-center">
              {t.survey.script}
            </p>
            <h2 className="font-serif text-heading-lg text-white mb-5">{t.survey.title}</h2>
            <p className="text-body-lg text-white/65 mb-8 max-w-2xl mx-auto">{t.survey.body}</p>
            <Link
              href="/survey"
              prefetch
              className="inline-flex items-center justify-center gap-2 rounded-full font-medium uppercase transition-all duration-300 px-8 py-3.5 text-sm tracking-[0.14em] bg-layali-pink-glow text-white hover:bg-layali-pink shadow-[0_0_20px_rgba(212,46,124,0.35)] btn-glow"
            >
              {t.survey.cta} <Sparkles className="w-5 h-5" />
            </Link>
          </FadeIn>
        </div>
      </section>

      <section className="py-6 sm:py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <DynamicBannerCarousel
              placement="landing_hero"
              initialSlides={landingBanners}
              className="border border-layali-pink/20 shadow-[0_0_40px_rgba(212,46,124,0.12)]"
            />
          </FadeIn>
        </div>
      </section>

      <CinematicProductFilm />

      <CinematicLookbook />

      {/* Enter the Store */}
      <section className="relative overflow-x-clip py-16 sm:py-20 text-center">
        <div
          className="glow-orb w-[520px] h-[520px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-55"
          aria-hidden
        />
        <FadeIn className="relative z-10 px-4">
          <p className="font-serif text-heading-md text-white mb-3">{t.glow.line1}</p>
          <p className="font-serif text-heading-lg text-layali-pink-light mb-8">
            {t.glow.line2}
          </p>
          <Link
            href="/shop"
            prefetch
            className="inline-flex items-center justify-center gap-2 rounded-full font-medium uppercase transition-all duration-300 px-8 py-3.5 text-nav tracking-[0.1em] border border-layali-pink/60 text-white hover:bg-layali-pink/10 hover:border-layali-pink hover:shadow-[0_0_24px_rgba(212,46,124,0.3)]"
          >
            {t.glow.enter} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
          </Link>
        </FadeIn>
      </section>
    </div>
  );
}

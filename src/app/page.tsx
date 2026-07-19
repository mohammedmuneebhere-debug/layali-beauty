'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Sparkles, Droplets, Leaf } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/FadeIn';
import { RitualCarousel } from '@/components/home/RitualCarousel';
import { BannerCarousel } from '@/components/banners/BannerCarousel';
import { PromoOffersGrid } from '@/components/banners/PromoOffersGrid';
import { LANDING_HERO_BANNERS, BRAND_PROMO_GRID } from '@/lib/banners';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

export default function HomePage() {
  const { t } = useLanguage();
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

  const categories = [
    { key: 'skincare', label: t.categories.skincare, href: 'skincare' },
    { key: 'haircare', label: t.categories.haircare, href: 'haircare' },
    { key: 'fragrance', label: t.categories.fragrance, href: 'fragrance' },
    { key: 'bodycare', label: t.categories.bodycare, href: 'bodycare' },
  ];

  const marquee = `${t.glow.line1}  ✦  ${t.brand}  ✦  ${t.tagline}  ✦  `;

  return (
    <div className="page-shell text-white">
      {/* Hero — concept UI */}
      <section
        ref={heroRef}
        className="relative min-h-[100svh] flex items-center overflow-hidden pt-20 section-glide-soft"
      >
        <motion.div style={{ y: yGlow }} className="absolute inset-0 pointer-events-none" aria-hidden>
          <div className="glow-orb w-[50vw] h-[50vw] max-w-[560px] max-h-[560px] left-[-8%] top-[20%] opacity-70" />
          <div className="glow-orb w-[28vw] h-[28vw] max-w-[320px] max-h-[320px] right-[-5%] bottom-[15%] opacity-35" />
        </motion.div>

        <motion.div
          style={{ opacity }}
          className="relative z-10 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24"
        >
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.85 }}
            className="max-w-2xl"
          >
            <p className="text-xs sm:text-sm tracking-[0.32em] text-layali-pink mb-6 uppercase">
              {t.hero.eyebrow}
            </p>
            <h1 className="font-serif text-5xl sm:text-6xl lg:text-8xl font-bold text-white leading-[0.95] mb-2">
              {t.hero.titleBeauty}
            </h1>
            <p className="font-script text-5xl sm:text-6xl lg:text-7xl text-layali-pink-light mb-6">
              {t.hero.titleRedefined}
            </p>
            <p className="text-white/70 text-base sm:text-lg max-w-md mb-10 leading-relaxed">
              {t.hero.subtitle}
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link href="/shop">
                <Button size="lg" className="rounded-full tracking-[0.14em] uppercase text-xs sm:text-sm">
                  {t.hero.shopCta} <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <Link
                href="/about"
                className="text-xs sm:text-sm tracking-[0.2em] uppercase text-white/80 hover:text-layali-pink-light transition-colors"
              >
                {t.hero.storyCta}
              </Link>
            </div>
          </motion.div>
        </motion.div>

        <div className="absolute bottom-8 inset-x-0 flex justify-center">
          <motion.p
            animate={{ opacity: [0.35, 0.8, 0.35], y: [0, 4, 0] }}
            transition={{ duration: 2.2, repeat: Infinity }}
            className="text-[10px] tracking-[0.35em] uppercase text-white/50"
          >
            {t.hero.scroll} ↓
          </motion.p>
        </div>
      </section>

      {/* Marquee ticker */}
      <div className="border-y border-layali-pink/20 section-glide overflow-hidden py-4">
        <div className="flex whitespace-nowrap animate-marquee">
          {[0, 1].map((i) => (
            <span
              key={i}
              className="mx-4 text-4xl sm:text-5xl font-serif italic text-transparent"
              style={{
                WebkitTextStroke: '1px rgba(224, 122, 138, 0.55)',
              }}
            >
              {marquee.repeat(3)}
            </span>
          ))}
        </div>
      </div>

      {/* K-beauty campaign banners */}
      <section className="py-10 sm:py-14 section-glide-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <BannerCarousel
              slides={LANDING_HERO_BANNERS}
              className="border border-layali-pink/20 shadow-[0_0_40px_rgba(212,46,124,0.12)]"
            />
          </FadeIn>
        </div>
      </section>

      {/* Glow CTA band */}
      <section className="relative py-24 section-glide overflow-hidden text-center">
        <div
          className="glow-orb w-[520px] h-[520px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-55"
          aria-hidden
        />
        <FadeIn className="relative z-10 px-4">
          <p className="font-serif text-3xl sm:text-4xl text-white mb-3">{t.glow.line1}</p>
          <p className="font-serif text-4xl sm:text-5xl lg:text-6xl text-layali-pink-light font-bold mb-8">
            {t.glow.line2}
          </p>
          <Link href="/shop">
            <Button
              variant="outline"
              size="lg"
              className="rounded-full border-layali-pink tracking-[0.16em] uppercase text-xs"
            >
              {t.glow.enter} <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </FadeIn>
      </section>

      <RitualCarousel />

      {/* Feature banner row */}
      <section className="py-12 section-glide-soft border-t border-layali-pink/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="mb-4">
            <p className="text-xs tracking-[0.22em] uppercase text-layali-pink">
              Spotlight
            </p>
          </FadeIn>
          <PromoOffersGrid items={BRAND_PROMO_GRID} />
        </div>
      </section>

      {/* Why Layali */}
      <section className="py-20 section-glide border-y border-layali-pink/15 relative overflow-hidden">
        <div className="glow-orb w-[400px] h-[400px] -right-32 top-0 opacity-50" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <h2 className="font-serif text-4xl font-bold text-white mb-4">{t.why.title}</h2>
            <p className="text-white/60 max-w-2xl mx-auto">{t.why.subtitle}</p>
          </FadeIn>

          <StaggerContainer className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <StaggerItem key={feature.title}>
                <div className="text-center p-8 rounded-2xl bg-black/45 backdrop-blur-md border border-layali-pink/20 card-hover h-full">
                  <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-layali-pink-glow/20 border border-layali-pink/40 flex items-center justify-center shadow-[0_0_20px_rgba(212,46,124,0.25)]">
                    <feature.icon className="w-7 h-7 text-layali-pink-light" />
                  </div>
                  <h3 className="font-serif text-xl font-bold text-white mb-3">{feature.title}</h3>
                  <p className="text-white/55 text-sm leading-relaxed">{feature.description}</p>
                </div>
              </StaggerItem>
            ))}
          </StaggerContainer>
        </div>
      </section>

      {/* Survey CTA */}
      <section className="py-20 section-glide-soft relative overflow-hidden">
        <div
          className="glow-orb w-[600px] h-[600px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-55"
          aria-hidden
        />
        <div className="relative max-w-4xl mx-auto px-4 text-center">
          <FadeIn>
            <p className="font-script text-4xl text-layali-pink-light mb-4">{t.survey.script}</p>
            <h2 className="font-serif text-4xl lg:text-5xl font-bold text-white mb-6">
              {t.survey.title}
            </h2>
            <p className="text-white/65 mb-8 max-w-2xl mx-auto leading-relaxed">{t.survey.body}</p>
            <Link href="/auth/signup">
              <Button variant="primary" size="lg">
                {t.survey.cta} <Sparkles className="w-5 h-5" />
              </Button>
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 section-glide border-t border-layali-pink/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-12">
            <h2 className="font-serif text-4xl font-bold text-white mb-4">{t.categories.title}</h2>
          </FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat, i) => (
              <FadeIn key={cat.key} delay={i * 0.1}>
                <Link href={`/shop?category=${cat.href}`}>
                  <div className="aspect-square rounded-2xl bg-black/40 backdrop-blur-md border border-layali-pink/25 flex items-center justify-center card-hover relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-t from-layali-pink-glow/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative font-serif text-lg font-bold text-white text-center px-2">
                      {cat.label}
                    </span>
                  </div>
                </Link>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

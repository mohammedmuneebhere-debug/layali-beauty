'use client';

import Link from 'next/link';
import { useRef } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Sparkles, Droplets, Leaf } from 'lucide-react';
import { FadeIn, StaggerContainer, StaggerItem } from '@/components/ui/FadeIn';
import { RitualCarousel } from '@/components/home/RitualCarousel';
import { DynamicBannerCarousel } from '@/components/banners/DynamicBanners';
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
    { key: 'makeup', label: t.categories.makeup, href: 'makeup' },
    { key: 'skincare', label: t.categories.skincare, href: 'skincare' },
    { key: 'haircare', label: t.categories.haircare, href: 'haircare' },
    { key: 'bodycare', label: t.categories.bodycare, href: 'bodycare' },
    { key: 'fragrance', label: t.categories.fragrance, href: 'fragrance' },
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
            <p className="text-meta tracking-[0.18em] text-layali-pink mb-6 uppercase">
              {t.hero.eyebrow}
            </p>
            <h1 className="font-serif text-hero text-white mb-1">
              {t.hero.titleBeauty}
            </h1>
            <p className="font-serif text-hero text-layali-pink-light mb-6">
              {t.hero.titleRedefined}
            </p>
            <p className="text-body-lg text-white/70 max-w-md mb-10">
              {t.hero.subtitle}
            </p>
            <div className="flex flex-wrap items-center gap-5">
              <Link
                href="/shop"
                prefetch
                className="inline-flex items-center justify-center gap-2 rounded-full font-medium uppercase transition-all duration-300 px-8 py-3.5 text-nav tracking-[0.1em] bg-layali-pink-glow text-white hover:bg-layali-pink shadow-[0_0_20px_rgba(212,46,124,0.35)] btn-glow"
              >
                {t.hero.shopCta} <ArrowRight className="w-4 h-4 rtl:rotate-180" />
              </Link>
              <Link
                href="/about"
                prefetch
                className="text-nav tracking-[0.12em] uppercase text-white/80 hover:text-layali-pink-light transition-colors"
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
            className="text-meta tracking-[0.2em] uppercase text-white/50"
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
              className="mx-4 text-heading-lg font-serif italic text-transparent"
              style={{
                WebkitTextStroke: '1px rgba(224, 122, 138, 0.55)',
              }}
            >
              {marquee.repeat(3)}
            </span>
          ))}
        </div>
      </div>

      {/* Campaign banners */}
      <section className="py-10 sm:py-14 section-glide-soft">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn>
            <DynamicBannerCarousel
              placement="landing_hero"
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
          <p className="font-serif text-heading-md text-white mb-3">{t.glow.line1}</p>
          <p className="font-serif text-heading-lg text-layali-pink-light font-bold mb-8">
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

      <RitualCarousel />

      {/* Why Layali */}
      <section className="py-20 section-glide border-y border-layali-pink/15 relative overflow-hidden">
        <div className="glow-orb w-[400px] h-[400px] -right-32 top-0 opacity-50" aria-hidden />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-16">
            <h2 className="font-serif text-heading-lg text-white mb-4">{t.why.title}</h2>
            <p className="text-body-lg text-white/60 max-w-2xl mx-auto">{t.why.subtitle}</p>
          </FadeIn>

          <StaggerContainer className="grid md:grid-cols-3 gap-8">
            {features.map((feature) => (
              <StaggerItem key={feature.title}>
                <div className="text-center p-8 rounded-2xl bg-black/45 backdrop-blur-md border border-layali-pink/20 card-hover h-full">
                  <div className="w-14 h-14 mx-auto mb-6 rounded-full bg-layali-pink-glow/20 border border-layali-pink/40 flex items-center justify-center shadow-[0_0_20px_rgba(212,46,124,0.25)]">
                    <feature.icon className="w-7 h-7 text-layali-pink-light" />
                  </div>
                  <h3 className="font-serif text-heading-sm text-white mb-3">{feature.title}</h3>
                  <p className="text-body text-white/55">{feature.description}</p>
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
            <p className="font-script text-script-xl text-layali-pink-light mb-4 scale-75 origin-center">
              {t.survey.script}
            </p>
            <h2 className="font-serif text-heading-lg text-white mb-6">{t.survey.title}</h2>
            <p className="text-body-lg text-white/65 mb-8 max-w-2xl mx-auto">{t.survey.body}</p>
            <Link
              href="/auth/signup"
              prefetch
              className="inline-flex items-center justify-center gap-2 rounded-full font-medium uppercase transition-all duration-300 px-8 py-3.5 text-sm tracking-[0.14em] bg-layali-pink-glow text-white hover:bg-layali-pink shadow-[0_0_20px_rgba(212,46,124,0.35)] btn-glow"
            >
              {t.survey.cta} <Sparkles className="w-5 h-5" />
            </Link>
          </FadeIn>
        </div>
      </section>

      {/* Categories */}
      <section className="py-20 section-glide border-t border-layali-pink/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <FadeIn className="text-center mb-12">
            <h2 className="font-serif text-heading-lg text-white mb-4">{t.categories.title}</h2>
          </FadeIn>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map((cat, i) => (
              <FadeIn key={cat.key} delay={i * 0.1}>
                <Link href={`/shop?category=${cat.href}`}>
                  <div className="aspect-square rounded-2xl bg-black/40 backdrop-blur-md border border-layali-pink/25 flex items-center justify-center card-hover relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-t from-layali-pink-glow/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <span className="relative font-serif text-heading-sm text-white text-center px-2">
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

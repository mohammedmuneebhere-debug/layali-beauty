'use client';

import { FadeIn } from '@/components/ui/FadeIn';
import { Heart, Sparkles } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

export default function AboutPageClient() {
  const { t } = useLanguage();
  const paragraphs = [t.manifesto.p1, t.manifesto.p2, t.manifesto.p3];

  return (
    <div className="relative min-h-screen bg-transparent pt-24 pb-20 overflow-hidden">
      <div
        className="glow-orb w-[520px] h-[520px] left-1/2 top-16 -translate-x-1/2 opacity-45 pointer-events-none"
        aria-hidden
      />
      <div
        className="glow-orb w-[280px] h-[280px] -start-16 bottom-24 opacity-30 pointer-events-none"
        aria-hidden
      />
      <div
        className="glow-orb w-[220px] h-[220px] -end-10 top-[38%] opacity-25 pointer-events-none"
        aria-hidden
      />
      <div
        className="glow-halo w-36 h-36 left-1/2 top-28 -translate-x-1/2 opacity-35 pointer-events-none"
        aria-hidden
      />

      <div className="relative max-w-3xl mx-auto px-4">
        <FadeIn className="text-center mb-14">
          <p className="text-meta tracking-[0.28em] uppercase text-layali-gold-light/85 mb-5">
            {t.brand}
          </p>
          <h1 className="font-serif text-heading-lg text-white mb-4">{t.manifesto.title}</h1>
          <p className="font-script text-heading-md text-layali-pink-light">{t.manifesto.script}</p>
          <div
            className="mx-auto mt-8 h-px w-24 bg-gradient-to-r from-transparent via-layali-gold-light to-transparent"
            aria-hidden
          />
        </FadeIn>

        <FadeIn delay={0.12}>
          <div className="relative glass-panel rounded-3xl p-8 lg:p-14 overflow-hidden shadow-[0_0_48px_rgba(212,46,124,0.12)]">
            <Sparkles
              className="absolute top-6 end-6 w-4 h-4 text-layali-gold-light/55"
              aria-hidden
            />
            <div className="space-y-8 text-body text-white/70 leading-relaxed">
              {paragraphs.map((text, i) => (
                <FadeIn key={text.slice(0, 24)} delay={0.08 * i}>
                  <p
                    className={
                      i === 0
                        ? 'font-serif text-[1.15rem] sm:text-heading-sm text-white/88 leading-snug'
                        : undefined
                    }
                  >
                    {text}
                  </p>
                </FadeIn>
              ))}
            </div>
            <div className="text-center pt-10 mt-6 border-t border-layali-pink/15">
              <Heart className="w-5 h-5 mx-auto text-layali-pink fill-layali-pink mb-3" />
              <p className="font-script text-heading-sm text-layali-pink-light">
                {t.manifesto.closing}
              </p>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

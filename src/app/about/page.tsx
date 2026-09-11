'use client';

import { FadeIn } from '@/components/ui/FadeIn';
import { Heart } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

export default function AboutPage() {
  const { t } = useLanguage();

  return (
    <div className="relative min-h-screen bg-transparent pt-24 pb-16 overflow-hidden">
      <div className="glow-orb w-[480px] h-[480px] left-1/2 top-24 -translate-x-1/2 opacity-40 pointer-events-none" />

      <div className="relative max-w-3xl mx-auto px-4">
        <FadeIn className="text-center mb-12">
          <h1 className="font-serif text-heading-lg text-white mb-4">{t.manifesto.title}</h1>
          <p className="font-serif text-heading-md text-layali-pink-light">{t.manifesto.script}</p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div className="glass-panel rounded-3xl p-8 lg:p-12 space-y-6 text-body text-white/65">
            <p>{t.manifesto.p1}</p>
            <p>{t.manifesto.p2}</p>
            <p>{t.manifesto.p3}</p>
            <div className="text-center pt-6">
              <Heart className="w-6 h-6 mx-auto text-layali-pink fill-layali-pink mb-2" />
              <p className="font-serif text-heading-sm text-layali-pink-light">{t.manifesto.closing}</p>
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}

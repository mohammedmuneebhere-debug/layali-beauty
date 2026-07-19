'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Mail, ArrowUpRight } from 'lucide-react';
import { useState } from 'react';
import { CONTACT_EMAIL } from '@/lib/constants';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

export function Footer() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const [email, setEmail] = useState('');

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/survey')
  ) {
    return null;
  }

  return (
    <footer className="section-glide-strong text-white mt-auto border-t border-layali-pink/20 relative overflow-hidden">
      <div className="glow-orb w-[360px] h-[360px] -bottom-40 -right-20 opacity-40" aria-hidden />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          <div>
            <h3 className="font-serif text-3xl font-bold tracking-widest mb-2">{t.brand}</h3>
            <p className="font-script text-2xl text-layali-pink-light mb-4">{t.tagline}</p>
            <p className="text-white/65 text-sm leading-relaxed max-w-md">{t.footer.blurb}</p>
          </div>

          <div>
            <h4 className="text-xs tracking-[0.2em] uppercase text-layali-pink mb-4">
              {t.footer.explore}
            </h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li>
                <Link href="/shop" className="hover:text-layali-pink transition-colors">
                  {t.footer.shopAll}
                </Link>
              </li>
              <li>
                <Link href="/shop?category=skincare" className="hover:text-layali-pink transition-colors">
                  {t.footer.serums}
                </Link>
              </li>
              <li>
                <Link href="/shop" className="hover:text-layali-pink transition-colors">
                  {t.footer.bestsellers}
                </Link>
              </li>
              <li>
                <Link href="/about" className="hover:text-layali-pink transition-colors">
                  {t.nav.manifesto}
                </Link>
              </li>
              <li>
                <Link href="/customer-care" className="hover:text-layali-pink transition-colors">
                  {t.nav.customerCare}
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs tracking-[0.2em] uppercase text-layali-pink mb-4">
              {t.footer.stayInGlow}
            </h4>
            <p className="text-sm text-white/60 mb-4">{t.footer.newsletter}</p>
            <form
              className="flex items-center gap-2 border-b border-white/25 pb-2"
              onSubmit={(e) => {
                e.preventDefault();
                window.location.href = `mailto:${CONTACT_EMAIL}?subject=Layali%20Glow%20List&body=${encodeURIComponent(email)}`;
              }}
            >
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.footer.emailPlaceholder}
                className="flex-1 bg-transparent text-sm text-white placeholder:text-white/35 outline-none"
                required
              />
              <button type="submit" className="text-layali-pink hover:text-layali-pink-light" aria-label="Subscribe">
                <ArrowUpRight className="w-4 h-4" />
              </button>
            </form>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-sm text-white/45 mt-4 hover:text-layali-pink transition-colors inline-flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              {CONTACT_EMAIL}
            </a>
            <p className="text-sm text-white/45 mt-4 flex items-center gap-1">
              {t.footer.madeWith} <Heart className="w-3 h-3 text-layali-pink fill-layali-pink" /> {t.footer.forYou}
            </p>
          </div>
        </div>

        <div className="border-t border-layali-pink/15 mt-8 pt-8 text-center text-sm text-white/40">
          <p>
            &copy; {new Date().getFullYear()} {t.brand}. {t.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}

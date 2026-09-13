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
            <Link href="/" prefetch className="inline-block group">
              <h3 className="text-brand text-white mb-2 group-hover:text-layali-pink-light transition-colors">
                {t.brand}
              </h3>
            </Link>
            <p className="text-eyebrow text-layali-pink mb-4">{t.brandSub}</p>
            <p className="text-body text-white/65 max-w-md mb-4">{t.footer.blurb}</p>
            <div className="space-y-1.5 text-meta text-white/55 font-mono tracking-wide min-w-0">
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                <span className="text-white/40 shrink-0">{t.footer.crNumber}:</span>
                <span dir="ltr" className="min-w-0 break-all">
                  7036159924
                </span>
              </p>
              <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 min-w-0">
                <span className="text-white/40 shrink-0">{t.footer.vatNumber}:</span>
                <span dir="ltr" className="min-w-0 break-all">
                  311925554900003
                </span>
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-meta tracking-[0.14em] uppercase text-layali-pink mb-4">
              {t.footer.explore}
            </h4>
            <ul className="space-y-2 text-body text-white/70">
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
            <h4 className="text-meta tracking-[0.14em] uppercase text-layali-pink mb-4">
              {t.footer.stayInGlow}
            </h4>
            <p className="text-body text-white/60 mb-4">{t.footer.newsletter}</p>
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
                className="flex-1 bg-transparent text-body text-white placeholder:text-white/35 outline-none"
                required
              />
              <button
                type="submit"
                className="inline-flex items-center justify-center min-h-11 min-w-11 text-layali-pink hover:text-layali-pink-light"
                aria-label="Subscribe"
              >
                <ArrowUpRight className="w-5 h-5 rtl:rotate-[-90deg]" />
              </button>
            </form>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="text-body text-white/45 mt-4 hover:text-layali-pink transition-colors inline-flex items-center gap-2"
            >
              <Mail className="w-4 h-4" />
              {CONTACT_EMAIL}
            </a>
            <p className="text-body text-white/45 mt-4 flex items-center gap-1">
              {t.footer.madeWith} <Heart className="w-3 h-3 text-layali-pink fill-layali-pink" /> {t.footer.forYou}
            </p>
          </div>
        </div>

        <div className="border-t border-layali-pink/15 mt-8 pt-8 text-center text-meta text-white/40">
          <p>
            &copy; {new Date().getFullYear()} {t.brand}. {t.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}

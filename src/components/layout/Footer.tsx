'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mail, Phone } from 'lucide-react';
import { CONTACT_EMAIL } from '@/lib/constants';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

const CONTACT_PHONE_DISPLAY = '+966 56 453 6958';
const CONTACT_PHONE_TEL = '+966564536958';
const INSTAGRAM_URL = 'https://www.instagram.com/layalibeautystore/';
const TIKTOK_URL = 'https://www.tiktok.com/@layalibeautystore';

type FooterEntry = {
  label: string;
  href?: string;
};

function FooterLink({ item }: { item: FooterEntry }) {
  const className =
    'inline-flex min-h-8 items-center py-0.5 text-[13px] leading-snug text-white/70 transition-colors hover:text-layali-pink-light focus-ring rounded-sm';

  if (!item.href) {
    return (
      <span className="inline-flex min-h-8 items-center py-0.5 text-[13px] leading-snug text-white/40">
        {item.label}
      </span>
    );
  }

  return (
    <Link href={item.href} className={className}>
      {item.label}
    </Link>
  );
}

function FooterColumn({
  id,
  title,
  items,
}: {
  id: string;
  title: string;
  items: FooterEntry[];
}) {
  return (
    <nav aria-labelledby={id}>
      <h3 id={id} className="text-meta tracking-[0.16em] uppercase text-layali-pink mb-2">
        {title}
      </h3>
      <ul className="space-y-0">
        {items.map((item) => (
          <li key={item.label}>
            <FooterLink item={item} />
          </li>
        ))}
      </ul>
    </nav>
  );
}

function FooterAccordion({ title, items }: { title: string; items: FooterEntry[] }) {
  return (
    <details className="group border-b border-white/10">
      <summary className="flex min-h-10 cursor-pointer list-none items-center justify-between gap-3 py-1.5 text-meta tracking-[0.16em] uppercase text-layali-pink focus-ring rounded-sm [&::-webkit-details-marker]:hidden">
        {title}
        <span className="text-white/40 transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <ul className="pb-2">
        {items.map((item) => (
          <li key={item.label}>
            <FooterLink item={item} />
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Lucide omits brand glyphs here — keep Instagram/TikTok as tiny inline SVGs (no new deps). */
function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1v-3.5a6.37 6.37 0 0 0-.79-.05A6.34 6.34 0 0 0 3.16 15.3a6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.34-6.34V8.73a8.19 8.19 0 0 0 4.76 1.52V6.84a4.84 4.84 0 0 1-1.01-.15Z" />
    </svg>
  );
}

function StayConnected() {
  const { t } = useLanguage();
  const linkClass =
    'inline-flex min-h-8 items-center gap-2 text-[13px] text-white/70 hover:text-layali-pink-light transition-colors focus-ring rounded-sm';

  return (
    <div>
      <h3 className="text-meta tracking-[0.16em] uppercase text-layali-pink mb-2">
        {t.footer.stayConnected}
      </h3>
      <div className="flex flex-col gap-1">
        <a href={`mailto:${CONTACT_EMAIL}`} className={linkClass}>
          <Mail className="w-3.5 h-3.5 shrink-0" aria-hidden />
          <span dir="ltr" className="break-all">
            {CONTACT_EMAIL}
          </span>
        </a>
        <a href={`tel:${CONTACT_PHONE_TEL}`} className={linkClass} dir="ltr">
          <Phone className="w-3.5 h-3.5 shrink-0" aria-hidden />
          {CONTACT_PHONE_DISPLAY}
        </a>
        <div className="flex items-center gap-1 pt-1">
          <a
            href={INSTAGRAM_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Instagram"
            className="inline-flex h-9 w-9 items-center justify-center text-white/70 hover:text-layali-pink-light transition-colors focus-ring rounded-sm"
          >
            <InstagramIcon className="w-4 h-4" />
          </a>
          <a
            href={TIKTOK_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="TikTok"
            className="inline-flex h-9 w-9 items-center justify-center text-white/70 hover:text-layali-pink-light transition-colors focus-ring rounded-sm"
          >
            <TikTokIcon className="w-4 h-4" />
          </a>
        </div>
      </div>
    </div>
  );
}

export function Footer() {
  const pathname = usePathname();
  const { t } = useLanguage();

  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/survey')
  ) {
    return null;
  }

  const brandLinks: FooterEntry[] = [
    { href: '/about', label: t.footer.aboutUs },
    { href: '/customer-care?tab=contact', label: t.footer.contactUs },
  ];

  const shopLinks: FooterEntry[] = [
    { href: '/shop?category=makeup', label: t.footer.makeup },
    { href: '/shop?category=skincare', label: t.footer.skincare },
    { href: '/shop?category=haircare', label: t.footer.haircare },
    { href: '/shop?category=fragrance', label: t.footer.fragrance },
  ];

  const careLinks: FooterEntry[] = [
    { href: '/customer-care', label: t.footer.helpCenter },
    { href: '/customer-care?tab=contact', label: t.footer.contactUs },
  ];

  const infoLinks: FooterEntry[] = [
    { href: '/about', label: t.footer.aboutLayali },
    { label: t.footer.privacy },
    { label: t.footer.careers },
    { label: t.footer.partner },
  ];

  return (
    <footer className="section-glide-strong text-white mt-auto border-t border-layali-pink/20 relative overflow-hidden">
      <div className="glow-orb w-[220px] h-[220px] -bottom-28 -end-12 opacity-15" aria-hidden />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-7 pb-5 lg:pt-9 lg:pb-6">
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-x-6 xl:gap-x-8 lg:items-start">
          <div className="lg:col-span-3">
            <Link
              href="/"
              prefetch
              className="inline-block group overflow-visible focus-ring rounded-md"
            >
              <p className="text-brand text-white group-hover:text-layali-pink-light transition-colors">
                {t.brand}
              </p>
            </Link>
            <p className="text-eyebrow text-layali-pink mt-1.5">{t.brandSub}</p>
            <p className="text-[13px] leading-relaxed text-white/60 mt-2.5 max-w-[15rem]">
              {t.footer.statement}
            </p>
            <ul className="mt-2">
              {brandLinks.map((item) => (
                <li key={item.label}>
                  <FooterLink item={item} />
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <FooterColumn id="footer-shop" title={t.footer.shop} items={shopLinks} />
          </div>
          <div className="lg:col-span-2">
            <FooterColumn id="footer-care" title={t.footer.customerCare} items={careLinks} />
          </div>
          <div className="lg:col-span-2">
            <FooterColumn id="footer-info" title={t.footer.information} items={infoLinks} />
          </div>
          <div className="lg:col-span-3">
            <StayConnected />
          </div>
        </div>

        <div className="lg:hidden">
          <div className="pb-4">
            <Link
              href="/"
              prefetch
              className="inline-block group overflow-visible focus-ring rounded-md"
            >
              <p className="text-brand text-white group-hover:text-layali-pink-light transition-colors">
                {t.brand}
              </p>
            </Link>
            <p className="text-eyebrow text-layali-pink mt-1.5">{t.brandSub}</p>
            <p className="text-[13px] leading-relaxed text-white/60 mt-2.5 max-w-sm">
              {t.footer.statement}
            </p>
            <ul className="mt-2">
              {brandLinks.map((item) => (
                <li key={item.label}>
                  <FooterLink item={item} />
                </li>
              ))}
            </ul>
          </div>

          <FooterAccordion title={t.footer.shop} items={shopLinks} />
          <FooterAccordion title={t.footer.customerCare} items={careLinks} />
          <FooterAccordion title={t.footer.information} items={infoLinks} />

          <div className="pt-4">
            <StayConnected />
          </div>
        </div>
      </div>

      <div className="relative border-t border-layali-pink/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5 text-meta text-white/45 font-mono tracking-wide">
            <p>
              <span className="text-white/30">{t.footer.crNumber}:</span>{' '}
              <span dir="ltr">7036159924</span>
            </p>
            <p>
              <span className="text-white/30">{t.footer.vatNumber}:</span>{' '}
              <span dir="ltr">311925554900003</span>
            </p>
          </div>
          <p className="text-meta text-white/40 sm:text-end">
            &copy; {new Date().getFullYear()} {t.brand}. {t.footer.rights}
          </p>
        </div>
      </div>
    </footer>
  );
}

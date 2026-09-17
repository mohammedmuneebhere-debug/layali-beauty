'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mail } from 'lucide-react';
import { CONTACT_EMAIL, CR_NUMBER, VAT_NUMBER } from '@/lib/constants';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

const CONTACT_PHONE_DISPLAY = '+966 56 453 6958';
const CONTACT_WHATSAPP_URL = 'https://wa.me/966564536958';
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

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.435 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
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
        <a
          href={CONTACT_WHATSAPP_URL}
          target="_blank"
          rel="noopener noreferrer"
          className={linkClass}
          dir="ltr"
          aria-label={`WhatsApp ${CONTACT_PHONE_DISPLAY}`}
        >
          <WhatsAppIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">{CONTACT_PHONE_DISPLAY}</span>
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
    <footer className="text-white mt-auto relative">
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
              <span dir="ltr">{CR_NUMBER}</span>
            </p>
            <p>
              <span className="text-white/30">{t.footer.vatNumber}:</span>{' '}
              <span dir="ltr">{VAT_NUMBER}</span>
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

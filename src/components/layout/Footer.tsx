'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Mail } from 'lucide-react';
import { CONTACT_EMAIL } from '@/lib/constants';
import { useLanguage } from '@/lib/i18n/LanguageProvider';

type FooterEntry = {
  label: string;
  href?: string;
};

function FooterLink({ item }: { item: FooterEntry }) {
  const className =
    'inline-flex min-h-10 items-center text-[13px] leading-snug text-white/70 transition-colors hover:text-layali-pink-light focus-ring rounded-sm lg:min-h-8';

  if (!item.href) {
    return (
      <span className="inline-flex min-h-10 items-center text-[13px] leading-snug text-white/40 lg:min-h-8">
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
      <h3 id={id} className="text-meta tracking-[0.18em] uppercase text-layali-pink mb-3">
        {title}
      </h3>
      <ul>
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
      <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 py-2 text-meta tracking-[0.18em] uppercase text-layali-pink focus-ring rounded-sm [&::-webkit-details-marker]:hidden">
        {title}
        <span className="text-white/40 transition-transform group-open:rotate-45" aria-hidden>
          +
        </span>
      </summary>
      <ul className="pb-3">
        {items.map((item) => (
          <li key={item.label}>
            <FooterLink item={item} />
          </li>
        ))}
      </ul>
    </details>
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
    { label: t.footer.nails },
    { label: t.footer.accessories },
    { href: '/shop?category=lenses', label: t.footer.lenses },
    { href: '/shop', label: t.footer.allProducts },
    { label: t.footer.newArrivals },
  ];

  const careLinks: FooterEntry[] = [
    { href: '/customer-care', label: t.footer.helpCenter },
    { href: '/account/orders', label: t.footer.trackOrder },
    { label: t.footer.shipping },
    { label: t.footer.returns },
    { label: t.footer.paymentMethods },
    { href: '/customer-care?tab=contact', label: t.footer.contactUs },
  ];

  const infoLinks: FooterEntry[] = [
    { href: '/about', label: t.footer.aboutLayali },
    { label: t.footer.privacy },
    { label: t.footer.terms },
    { label: t.footer.refundPolicy },
    { label: t.footer.shippingPolicy },
    { label: t.footer.careers },
    { label: t.footer.partner },
  ];

  return (
    <footer className="section-glide-strong text-white mt-auto border-t border-layali-pink/20 relative overflow-hidden">
      <div className="glow-orb w-[280px] h-[280px] -bottom-36 -end-16 opacity-20" aria-hidden />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8 lg:pt-14">
        {/* Desktop multi-column */}
        <div className="hidden lg:grid lg:grid-cols-12 lg:gap-x-8 xl:gap-x-10">
          <div className="lg:col-span-3">
            <Link
              href="/"
              prefetch
              className="inline-block group overflow-visible py-0.5 focus-ring rounded-md"
            >
              <p className="text-brand text-white group-hover:text-layali-pink-light transition-colors">
                {t.brand}
              </p>
            </Link>
            <p className="text-eyebrow text-layali-pink mt-2">{t.brandSub}</p>
            <p className="text-body text-white/60 mt-4 max-w-[16.5rem]">{t.footer.statement}</p>
            <ul className="mt-4">
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
            <h3 className="text-meta tracking-[0.18em] uppercase text-layali-pink mb-3">
              {t.footer.stayConnected}
            </h3>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex min-h-8 items-center gap-2 text-[13px] text-white/70 hover:text-layali-pink-light transition-colors focus-ring rounded-sm"
            >
              <Mail className="w-4 h-4 shrink-0" aria-hidden />
              <span dir="ltr" className="break-all">
                {CONTACT_EMAIL}
              </span>
            </a>
          </div>
        </div>

        {/* Mobile stacked brand + accordions */}
        <div className="lg:hidden">
          <div className="pb-6">
            <Link
              href="/"
              prefetch
              className="inline-block group overflow-visible py-0.5 focus-ring rounded-md"
            >
              <p className="text-brand text-white group-hover:text-layali-pink-light transition-colors">
                {t.brand}
              </p>
            </Link>
            <p className="text-eyebrow text-layali-pink mt-2">{t.brandSub}</p>
            <p className="text-body text-white/60 mt-4 max-w-sm">{t.footer.statement}</p>
            <ul className="mt-3">
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

          <div className="pt-6">
            <h3 className="text-meta tracking-[0.18em] uppercase text-layali-pink mb-3">
              {t.footer.stayConnected}
            </h3>
            <a
              href={`mailto:${CONTACT_EMAIL}`}
              className="inline-flex min-h-10 items-center gap-2 text-[13px] text-white/70 hover:text-layali-pink-light transition-colors focus-ring rounded-sm"
            >
              <Mail className="w-4 h-4 shrink-0" aria-hidden />
              <span dir="ltr" className="break-all">
                {CONTACT_EMAIL}
              </span>
            </a>
          </div>
        </div>
      </div>

      <div className="relative border-t border-layali-pink/15">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1 text-meta text-white/45 font-mono tracking-wide">
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

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ShoppingBag, User, Menu, X, Search, ChevronDown } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useCartStore } from '@/store/cart';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { SearchOverlay } from '@/components/layout/SearchOverlay';
import { STOREFRONT_NAV_CATEGORIES } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const itemCount = useCartStore((s) => s.totalQuantity);
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const menuId = useId();
  const categoriesId = useId();

  const navLinks = [
    { href: '/', label: t.nav.home },
    { href: '/shop', label: t.nav.shop },
    { href: '/combos', label: t.nav.combos },
    { href: '/about', label: t.nav.manifesto },
    { href: '/customer-care', label: t.nav.customerCare },
  ];

  const [menuPathname, setMenuPathname] = useState(pathname);
  if (pathname !== menuPathname) {
    setMenuPathname(pathname);
    if (mobileOpen) setMobileOpen(false);
    if (categoriesOpen) setCategoriesOpen(false);
    if (searchOpen) setSearchOpen(false);
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mobileOpen]);

  if (pathname.startsWith('/admin') || pathname.startsWith('/auth')) return null;

  const overlayHero = pathname === '/' && !scrolled && !mobileOpen;

  return (
    <>
      <header
        className={cn(
          'fixed top-0 inset-x-0 z-50 transition-[background,border-color,backdrop-filter] duration-300',
          overlayHero
            ? 'bg-transparent border-b border-transparent'
            : 'glass-dark'
        )}
      >
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 lg:h-20 gap-2 sm:gap-3">
            <Link
              href="/"
              prefetch
              className="flex flex-col items-start justify-center group min-w-0 flex-1 overflow-visible me-1 focus-ring rounded-md"
              onClick={() => setMobileOpen(false)}
            >
              <span className="text-brand text-white group-hover:text-layali-pink-light transition-colors whitespace-nowrap">
                {t.brand}
              </span>
              <span className="text-meta uppercase tracking-[0.14em] sm:tracking-[0.2em] text-layali-pink -mt-0.5 truncate w-full">
                {t.brandSub}
              </span>
            </Link>

            <div className="hidden lg:flex items-center gap-6 xl:gap-8 rtl:gap-7 shrink-0">
              {navLinks.map((link) => {
                const active =
                  link.href === '/'
                    ? pathname === '/'
                    : pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    prefetch
                    className={cn(
                      'relative text-nav tracking-[0.12em] uppercase transition-colors focus-ring rounded-sm',
                      active ? 'text-white' : 'text-white/60 hover:text-layali-pink-light'
                    )}
                  >
                    {link.label}
                    {active && (
                      <motion.span
                        layoutId="nav-glow"
                        className="absolute -bottom-1 left-0 right-0 h-px bg-layali-gold-light/80"
                      />
                    )}
                  </Link>
                );
              })}
              <div
                className="relative"
                onMouseEnter={() => setCategoriesOpen(true)}
                onMouseLeave={() => setCategoriesOpen(false)}
              >
                <button
                  type="button"
                  className={cn(
                    'inline-flex items-center gap-1 text-nav tracking-[0.12em] uppercase transition-colors focus-ring rounded-sm',
                    pathname.startsWith('/shop')
                      ? 'text-white'
                      : 'text-white/60 hover:text-layali-pink-light'
                  )}
                  aria-expanded={categoriesOpen}
                  aria-controls={categoriesId}
                  onClick={() => setCategoriesOpen((open) => !open)}
                >
                  {t.nav.categories}
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <AnimatePresence>
                  {categoriesOpen && (
                    <motion.div
                      id={categoriesId}
                      initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduceMotion ? undefined : { opacity: 0, y: 6 }}
                      className="absolute start-0 top-full pt-3"
                    >
                      <div className="min-w-[16rem] rounded-2xl border border-white/10 bg-black/92 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur">
                        {STOREFRONT_NAV_CATEGORIES.map((cat) => (
                          <Link
                            key={cat.value}
                            href={`/shop?category=${cat.value}`}
                            className="block rounded-xl px-3 py-2.5 text-sm text-white/70 hover:bg-white/5 hover:text-white focus-ring"
                            onClick={() => setCategoriesOpen(false)}
                          >
                            {cat.label}
                          </Link>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            <div className="flex items-center gap-1 sm:gap-2 shrink-0">
              <LanguageSwitcher />
              <button
                type="button"
                className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-full border border-layali-pink/25 text-white hover:border-layali-pink transition-all focus-ring"
                aria-label={t.nav.search}
                onClick={() => {
                  setSearchOpen(true);
                  setMobileOpen(false);
                }}
              >
                <Search className="w-5 h-5" />
              </button>
              <Link
                href="/account"
                className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-full border border-layali-pink/25 text-white hover:border-layali-pink transition-all focus-ring"
                aria-label={t.nav.account}
                onClick={() => setMobileOpen(false)}
              >
                <User className="w-5 h-5" />
              </Link>
              <Link
                href="/cart"
                className="relative inline-flex items-center justify-center min-h-11 min-w-11 rounded-full border border-layali-pink/25 text-white hover:border-layali-pink transition-all focus-ring"
                aria-label={t.nav.cart}
                onClick={() => setMobileOpen(false)}
              >
                <ShoppingBag className="w-5 h-5" />
                {itemCount > 0 && (
                  <motion.span
                    initial={reduceMotion ? false : { scale: 0 }}
                    animate={{ scale: 1 }}
                    className="absolute -top-1 -end-1 z-10 min-w-[18px] h-[18px] px-1 bg-layali-pink-glow text-white text-meta rounded-full flex items-center justify-center"
                  >
                    {itemCount}
                  </motion.span>
                )}
              </Link>
              <button
                type="button"
                className="lg:hidden inline-flex items-center justify-center min-h-11 min-w-11 text-white focus-ring rounded-full"
                onClick={() => setMobileOpen((open) => !open)}
                aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={mobileOpen}
                aria-controls={menuId}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <AnimatePresence>
            {mobileOpen && (
              <>
                <motion.button
                  type="button"
                  key="mobile-nav-backdrop"
                  initial={reduceMotion ? false : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={reduceMotion ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="lg:hidden fixed inset-0 top-16 z-40 bg-black/55"
                  aria-label="Dismiss menu overlay"
                  onClick={() => setMobileOpen(false)}
                />
                <motion.div
                  id={menuId}
                  key="mobile-nav-panel"
                  initial={reduceMotion ? false : { opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={reduceMotion ? undefined : { opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  className="lg:hidden relative z-50 border-t border-layali-pink/20 py-3 max-h-[min(70vh,calc(100dvh-4rem))] overflow-y-auto overscroll-contain"
                >
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className="block py-3 px-1 text-nav text-white/80 hover:text-layali-pink-light min-h-11"
                    >
                      {link.label}
                    </Link>
                  ))}
                  <p className="px-1 pt-3 pb-1 text-meta uppercase tracking-[0.16em] text-white/40">
                    {t.nav.categories}
                  </p>
                  {STOREFRONT_NAV_CATEGORIES.map((cat) => (
                    <Link
                      key={cat.value}
                      href={`/shop?category=${cat.value}`}
                      onClick={() => setMobileOpen(false)}
                      className="block py-3 px-1 text-nav text-white/80 hover:text-layali-pink-light min-h-11 focus-ring rounded-lg"
                    >
                      {cat.label}
                    </Link>
                  ))}
                </motion.div>
              </>
            )}
          </AnimatePresence>
        </nav>
      </header>
      <SearchOverlay open={searchOpen} onClose={() => setSearchOpen(false)} />
    </>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { ShoppingBag, User, Menu, X } from 'lucide-react';
import { useEffect, useId, useState } from 'react';
import { useCartStore } from '@/store/cart';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const itemCount = useCartStore((s) => s.totalQuantity);
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const menuId = useId();

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
  }

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

  return (
    <header className="fixed top-0 inset-x-0 z-50 glass-dark">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20 gap-2 sm:gap-3">
          <Link
            href="/"
            prefetch
            className="flex flex-col items-start justify-center group min-w-0 flex-1 overflow-hidden me-1"
            onClick={() => setMobileOpen(false)}
          >
            <span className="text-brand text-white group-hover:text-layali-pink-light transition-colors whitespace-nowrap">
              {t.brand}
            </span>
            <span className="text-meta uppercase tracking-[0.14em] sm:tracking-[0.2em] text-layali-pink -mt-0.5 truncate w-full">
              {t.brandSub}
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 lg:gap-8 rtl:gap-7 shrink-0">
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
                    'relative text-nav tracking-[0.12em] uppercase transition-colors',
                    active ? 'text-white' : 'text-white/60 hover:text-layali-pink-light'
                  )}
                >
                  {link.label}
                  {active && (
                    <motion.span
                      layoutId="nav-glow"
                      className="absolute -bottom-1 left-0 right-0 h-0.5 bg-layali-pink-glow shadow-[0_0_8px_rgba(212,46,124,0.8)]"
                    />
                  )}
                </Link>
              );
            })}
          </div>

          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            <LanguageSwitcher />
            <Link
              href="/account"
              className="inline-flex items-center justify-center min-h-11 min-w-11 rounded-full border border-layali-pink/25 text-white hover:border-layali-pink hover:shadow-[0_0_14px_rgba(212,46,124,0.35)] transition-all"
              aria-label={t.nav.account}
              onClick={() => setMobileOpen(false)}
            >
              <User className="w-5 h-5" />
            </Link>
            <Link
              href="/cart"
              className="relative inline-flex items-center justify-center min-h-11 min-w-11 rounded-full border border-layali-pink/25 text-white hover:border-layali-pink hover:shadow-[0_0_14px_rgba(212,46,124,0.35)] transition-all"
              aria-label={t.nav.cart}
              onClick={() => setMobileOpen(false)}
            >
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <motion.span
                  initial={reduceMotion ? false : { scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -end-1 z-10 min-w-[18px] h-[18px] px-1 bg-layali-pink-glow text-white text-meta rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(212,46,124,0.7)]"
                >
                  {itemCount}
                </motion.span>
              )}
            </Link>
            <button
              type="button"
              className="md:hidden inline-flex items-center justify-center min-h-11 min-w-11 text-white"
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
                className="md:hidden fixed inset-0 top-16 z-40 bg-black/55"
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
                className="md:hidden relative z-50 border-t border-layali-pink/20 py-3 max-h-[min(70vh,calc(100dvh-4rem))] overflow-y-auto overscroll-contain"
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
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}

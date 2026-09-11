'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, User, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { useCartStore } from '@/store/cart';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { cn } from '@/lib/utils';

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const itemCount = useCartStore((s) => s.itemCount());
  const { t } = useLanguage();

  const navLinks = [
    { href: '/', label: t.nav.home },
    { href: '/shop', label: t.nav.shop },
    { href: '/combos', label: t.nav.combos },
    { href: '/about', label: t.nav.manifesto },
    { href: '/customer-care', label: t.nav.customerCare },
  ];

  if (pathname.startsWith('/admin') || pathname.startsWith('/auth')) return null;

  return (
    <header className="fixed top-0 inset-x-0 z-50 glass-dark">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link href="/" prefetch className="flex flex-col items-start group">
            <span className="font-serif text-display-sm lg:text-display-md font-bold tracking-[0.12em] text-white group-hover:text-layali-pink-light transition-colors">
              {t.brand}
            </span>
            <span className="text-meta tracking-[0.18em] text-layali-pink -mt-1">
              {t.brandSub}
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-6 lg:gap-8 rtl:gap-7">
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

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              href="/account"
              className="p-2.5 rounded-full border border-layali-pink/25 text-white hover:border-layali-pink hover:shadow-[0_0_14px_rgba(212,46,124,0.35)] transition-all"
              aria-label={t.nav.account}
            >
              <User className="w-5 h-5" />
            </Link>
            <Link
              href="/cart"
              className="relative p-2.5 rounded-full border border-layali-pink/25 text-white hover:border-layali-pink hover:shadow-[0_0_14px_rgba(212,46,124,0.35)] transition-all"
              aria-label={t.nav.cart}
            >
              <ShoppingBag className="w-5 h-5" />
              {itemCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -end-1 min-w-[18px] h-[18px] px-1 bg-layali-pink-glow text-white text-meta rounded-full flex items-center justify-center shadow-[0_0_10px_rgba(212,46,124,0.7)]"
                >
                  {itemCount}
                </motion.span>
              )}
            </Link>
            <button
              className="md:hidden p-2 text-white"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Menu"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="md:hidden border-t border-layali-pink/20 py-4 overflow-hidden"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-2.5 text-nav text-white/70 hover:text-layali-pink-light"
                >
                  {link.label}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}

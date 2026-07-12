'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingBag, User, Menu, X, Heart } from 'lucide-react';
import { useState } from 'react';
import { useCartStore } from '@/store/cart';
import { cn } from '@/lib/utils';

const navLinks = [
  { href: '/shop', label: 'Shop' },
  { href: '/combos', label: 'Combos' },
  { href: '/about', label: 'About' },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const itemCount = useCartStore((s) => s.itemCount());

  if (pathname.startsWith('/admin') || pathname.startsWith('/auth')) return null;

  return (
    <header className="sticky top-0 z-50 glass">
      <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 lg:h-20">
          <Link href="/" className="flex flex-col items-start">
            <span className="font-serif text-2xl lg:text-3xl font-bold tracking-widest text-layali-black">
              LAYALI
            </span>
            <span className="text-[10px] tracking-[0.3em] text-layali-black/60 -mt-1">
              BEAUTY REDEFINED
            </span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  'text-sm font-medium tracking-wide transition-colors hover:text-layali-pink-dark',
                  pathname === link.href ? 'text-layali-pink-dark' : 'text-layali-black/70'
                )}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link href="/account" className="p-2 rounded-full hover:bg-layali-pink-light/50 transition-colors">
              <User className="w-5 h-5 text-layali-black" />
            </Link>
            <Link href="/cart" className="relative p-2 rounded-full hover:bg-layali-pink-light/50 transition-colors">
              <ShoppingBag className="w-5 h-5 text-layali-black" />
              {itemCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-layali-black text-white text-xs rounded-full flex items-center justify-center"
                >
                  {itemCount}
                </motion.span>
              )}
            </Link>
            <button
              className="md:hidden p-2"
              onClick={() => setMobileOpen(!mobileOpen)}
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
              className="md:hidden border-t border-layali-pink/20 py-4"
            >
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block py-2 text-sm font-medium text-layali-black/70 hover:text-layali-pink-dark"
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

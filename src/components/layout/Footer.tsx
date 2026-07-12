'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Heart, Share2, Mail } from 'lucide-react';

export function Footer() {
  const pathname = usePathname();

  if (pathname.startsWith('/admin') || pathname.startsWith('/auth') || pathname.startsWith('/survey')) {
    return null;
  }

  return (
    <footer className="gradient-dark text-white mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <h3 className="font-serif text-3xl font-bold tracking-widest mb-2">LAYALI</h3>
            <p className="text-layali-pink-light text-sm tracking-[0.2em] mb-4">BEAUTY REDEFINED</p>
            <p className="text-white/70 text-sm leading-relaxed max-w-md">
              Premium beauty products crafted with love for the modern woman.
              Experience luxury skincare, haircare, and fragrances tailored just for you.
            </p>
          </div>

          <div>
            <h4 className="font-medium mb-4 tracking-wide">Quick Links</h4>
            <ul className="space-y-2 text-sm text-white/70">
              <li><Link href="/shop" className="hover:text-layali-pink transition-colors">Shop</Link></li>
              <li><Link href="/combos" className="hover:text-layali-pink transition-colors">Combos</Link></li>
              <li><Link href="/about" className="hover:text-layali-pink transition-colors">About Us</Link></li>
              <li><Link href="/account" className="hover:text-layali-pink transition-colors">My Account</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-medium mb-4 tracking-wide">Connect</h4>
            <div className="flex gap-3">
              <a href="#" className="p-2 rounded-full bg-white/10 hover:bg-layali-pink/30 transition-colors">
                <Share2 className="w-5 h-5" />
              </a>
              <a href="mailto:hello@layali.com" className="p-2 rounded-full bg-white/10 hover:bg-layali-pink/30 transition-colors">
                <Mail className="w-5 h-5" />
              </a>
            </div>
            <p className="text-sm text-white/50 mt-4 flex items-center gap-1">
              Made with <Heart className="w-3 h-3 text-layali-pink fill-layali-pink" /> for you
            </p>
          </div>
        </div>

        <div className="border-t border-white/10 mt-8 pt-8 text-center text-sm text-white/50">
          <p>&copy; {new Date().getFullYear()} Layali. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

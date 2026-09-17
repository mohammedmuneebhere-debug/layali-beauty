'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { track } from '@/lib/track';
import { lockDocumentScroll } from '@/lib/lock-document-scroll';

export function SearchOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { t } = useLanguage();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const titleId = useId();
  const [query, setQuery] = useState('');

  useEffect(() => {
    if (!open) return;
    const unlock = lockDocumentScroll();
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unlock();
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const q = query.trim();
    onClose();
    if (!q) {
      router.push('/shop');
      return;
    }
    track({ event: 'search', query: q });
    router.push(`/shop?q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="fixed inset-0 z-[70]">
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label={t.nav.closeSearch}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative mx-auto mt-[18vh] w-[min(92vw,36rem)] rounded-3xl border border-white/10 bg-layali-black/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)]"
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 id={titleId} className="font-serif text-heading-sm text-white">
            {t.nav.search}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-white/70 hover:text-white focus-ring"
            aria-label={t.nav.closeSearch}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={submit} className="relative">
          <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.nav.searchPlaceholder}
            className="w-full rounded-full border border-white/15 bg-white/5 py-3.5 ps-11 pe-4 text-white placeholder:text-white/35 focus:border-layali-pink/50 focus:outline-none"
          />
        </form>
      </div>
    </div>
  );
}

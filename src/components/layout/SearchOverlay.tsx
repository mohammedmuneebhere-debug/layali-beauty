'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { track } from '@/lib/track';
import { lockDocumentScroll } from '@/lib/lock-document-scroll';
import { productSearchPath, resolveSearchAction, searchableBrand, shopSearchPath } from '@/lib/shop-search';
import { cn, formatPrice } from '@/lib/utils';

type Suggestion = {
  id: string;
  handle: string;
  name: string;
  vendor: string;
  price: number;
  image_url: string | null;
};

const TABBABLE =
  'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]';

function tabbableElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(TABBABLE)].filter((element) => {
    if (element.tabIndex < 0) return false;
    return element.getClientRects().length > 0;
  });
}

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
  const overlayRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  const listId = useId();
  const [query, setQuery] = useState('');
  const [request, setRequest] = useState<{
    query: string;
    products: Suggestion[];
    status: 'loading' | 'ready';
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [openSnapshot, setOpenSnapshot] = useState(open);
  if (open !== openSnapshot) {
    setOpenSnapshot(open);
    if (!open) {
      setQuery('');
      setRequest(null);
      setActiveIndex(-1);
    }
  }

  useEffect(() => {
    if (!open) {
      const opener = openerRef.current;
      openerRef.current = null;
      if (opener?.isConnected) opener.focus();
      return;
    }

    const previous = document.activeElement;
    if (
      previous instanceof HTMLElement &&
      previous !== document.body &&
      !overlayRef.current?.contains(previous)
    ) {
      openerRef.current = previous;
    }
    const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => window.clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    onCloseRef.current = onClose;
    const unlock = lockDocumentScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const root = overlayRef.current;
      if (!root) return;
      const focusable = tabbableElements(root);
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      const inside = active instanceof Node && root.contains(active);
      if (event.shiftKey) {
        if (!inside || active === first) {
          event.preventDefault();
          last.focus();
        }
      } else if (!inside || active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      unlock();
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) return;

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setRequest({ query: q, products: [], status: 'loading' });
      void fetch(`/api/shopify/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then(async (res) => {
          if (controller.signal.aborted) return;
          const json = (await res.json()) as { products?: Suggestion[] };
          if (!res.ok) throw new Error('search failed');
          setRequest({ query: q, products: json.products || [], status: 'ready' });
          setActiveIndex(-1);
        })
        .catch((error: unknown) => {
          if (error instanceof DOMException && error.name === 'AbortError') return;
          if (controller.signal.aborted) return;
          setRequest({ query: q, products: [], status: 'ready' });
          setActiveIndex(-1);
        });
    }, 180);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [open, query]);

  if (!open) return null;

  const trimmed = query.trim();
  const current = request?.query === trimmed ? request : null;
  const suggestions = current?.status === 'ready' ? current.products : [];
  const loading = trimmed.length >= 2 && current?.status !== 'ready';
  const showList = loading || suggestions.length > 0;
  const showEmpty = current?.status === 'ready' && suggestions.length === 0;
  const optionCount = suggestions.length + (suggestions.length > 0 ? 1 : 0);

  const go = (href: string) => {
    if (trimmed) track({ event: 'search', query: trimmed });
    onClose();
    router.push(href);
  };

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    go(resolveSearchAction({ query, activeIndex, suggestions }));
  };

  const onInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, optionCount - 1));
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, -1));
    } else if (event.key === 'Enter') {
      event.preventDefault();
      go(resolveSearchAction({ query, activeIndex, suggestions }));
    }
  };

  return (
    <div ref={overlayRef} className="fixed inset-0 z-[70]">
      <button
        type="button"
        tabIndex={-1}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        aria-label={t.nav.closeSearch}
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative mx-auto mt-[10vh] w-[min(92vw,36rem)] rounded-3xl border border-white/10 bg-layali-black/95 p-5 shadow-[0_24px_80px_rgba(0,0,0,0.55)] sm:mt-[18vh]"
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
        <form onSubmit={submit} className="relative" role="search">
          <Search className="pointer-events-none absolute start-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={onInputKeyDown}
            placeholder={t.nav.searchPlaceholder}
            role="combobox"
            aria-expanded={showList || showEmpty}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={activeIndex >= 0 ? `${listId}-option-${activeIndex}` : undefined}
            className="w-full rounded-full border border-white/15 bg-white/5 py-3.5 ps-11 pe-4 text-white placeholder:text-white/35 focus:border-layali-pink/50 focus:outline-none"
          />
          <p className="sr-only" aria-live="polite">
            {loading
              ? t.nav.searching
              : showEmpty
                ? t.nav.noResults
                : suggestions.length > 0
                  ? `${suggestions.length}`
                  : ''}
          </p>
          {showList ? (
            <ul
              id={listId}
              role="listbox"
              aria-label={t.nav.search}
              className="mt-3 max-h-[min(50vh,24rem)] overflow-y-auto rounded-2xl border border-white/10"
            >
              {suggestions.map((product, index) => {
                const active = index === activeIndex;
                return (
                  <li key={product.id} role="presentation">
                    <Link
                      id={`${listId}-option-${index}`}
                      role="option"
                      aria-selected={active}
                      href={productSearchPath(product)}
                      onClick={() => {
                        if (trimmed) track({ event: 'search', query: trimmed });
                        onClose();
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      className={cn(
                        'flex min-h-11 items-center gap-3 px-3 py-2.5 text-start focus-ring',
                        active ? 'bg-white/10' : 'hover:bg-white/5'
                      )}
                    >
                      <span className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-white/5">
                        {product.image_url ? (
                          // Suggestions are already CDN-sized catalog thumbnails.
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.image_url}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </span>
                      <span className="min-w-0 flex-1">
                        {searchableBrand(product.vendor) ? (
                          <span className="block truncate text-[11px] uppercase tracking-[0.14em] text-layali-pink">
                            {searchableBrand(product.vendor)}
                          </span>
                        ) : null}
                        <span className="block truncate text-sm text-white">{product.name}</span>
                      </span>
                      <span className="shrink-0 text-sm tabular-nums text-white/80">
                        {formatPrice(Number(product.price))}
                      </span>
                    </Link>
                  </li>
                );
              })}
              {suggestions.length > 0 ? (
                <li role="presentation">
                  <button
                    id={`${listId}-option-${suggestions.length}`}
                    type="button"
                    role="option"
                    aria-selected={activeIndex === suggestions.length}
                    onMouseEnter={() => setActiveIndex(suggestions.length)}
                    onClick={() => go(shopSearchPath(query))}
                    className={cn(
                      'flex min-h-11 w-full items-center px-3 text-start text-sm text-layali-pink focus-ring',
                      activeIndex === suggestions.length ? 'bg-white/10' : 'hover:bg-white/5'
                    )}
                  >
                    {t.nav.viewAllResults}
                  </button>
                </li>
              ) : (
                <li className="px-3 py-3 text-sm text-white/50">{t.nav.searching}</li>
              )}
            </ul>
          ) : null}
          {showEmpty ? (
            <p id={listId} className="mt-3 rounded-2xl border border-white/10 px-3 py-4 text-sm text-white/60">
              {t.nav.noResults}
            </p>
          ) : null}
        </form>
      </div>
    </div>
  );
}

'use client';

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Sparkles, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { formatPrice, cn } from '@/lib/utils';
import { track } from '@/lib/track';
import type { AssistantReply } from '@/lib/assistant';

type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  products?: AssistantReply['products'];
};

export function AskLayali() {
  const pathname = usePathname();
  const { t } = useLanguage();
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);

  const hidden =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/checkout');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer);
    };
  }, [open]);

  if (hidden) return null;

  const onProductDetail = /^\/shop\/.+/.test(pathname);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setQuery('');
    setTurns((prev) => [
      ...prev,
      { id: `u-${Date.now()}`, role: 'user', text: trimmed },
    ]);
    setLoading(true);
    try {
      const res = await fetch('/api/assistant/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: trimmed }),
      });
      const json = (await res.json()) as AssistantReply & { error?: string };
      setTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: json.message || json.error || t.assistant.error,
          products: json.products || [],
        },
      ]);
    } catch {
      setTurns((prev) => [
        ...prev,
        { id: `a-${Date.now()}`, role: 'assistant', text: t.assistant.error },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={cn(
          'fixed end-4 z-[45] inline-flex min-h-12 items-center gap-2 rounded-full border border-layali-gold/30 bg-black/80 px-4 text-sm tracking-[0.08em] text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur hover:border-layali-gold/60 focus-ring',
          onProductDetail
            ? 'bottom-[calc(6.25rem+env(safe-area-inset-bottom,0px))] sm:bottom-5 max-sm:end-3 max-sm:min-w-12 max-sm:justify-center max-sm:px-3'
            : 'bottom-5'
        )}
        aria-label={t.assistant.open}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) track({ event: 'AI_assistant_open' });
            return next;
          });
        }}
      >
        <Sparkles className="h-4 w-4 text-layali-gold-light" />
        <span className={onProductDetail ? 'max-sm:hidden' : undefined}>{t.assistant.teaser}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            id={panelId}
            role="dialog"
            aria-label={t.assistant.title}
            initial={reduceMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? undefined : { opacity: 0, y: 12 }}
            className={cn(
              'fixed end-4 z-[45] flex h-[min(70vh,34rem)] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-layali-black/95 shadow-[0_24px_80px_rgba(0,0,0,0.5)]',
              onProductDetail
                ? 'bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-20'
                : 'bottom-20'
            )}
          >
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <div>
                <p className="text-meta uppercase tracking-[0.16em] text-layali-gold-light">
                  {t.pdp.curated}
                </p>
                <h2 className="font-serif text-lg text-white">{t.assistant.title}</h2>
              </div>
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-white/70 hover:text-white"
                aria-label={t.assistant.close}
                onClick={() => setOpen(false)}
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {turns.length === 0 ? (
                <p className="text-sm leading-relaxed text-white/60">{t.assistant.empty}</p>
              ) : (
                turns.map((turn) => (
                  <div key={turn.id} className={turn.role === 'user' ? 'text-end' : ''}>
                    <p
                      className={
                        turn.role === 'user'
                          ? 'inline-block rounded-2xl bg-white/10 px-3 py-2 text-sm text-white'
                          : 'text-sm leading-relaxed text-white/80'
                      }
                    >
                      {turn.text}
                    </p>
                    {turn.products && turn.products.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-start">
                        {turn.products.map((product) => (
                          <li key={product.id}>
                            <Link
                              href={`/shop/${product.handle || product.id}`}
                              className="flex gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-2 hover:border-layali-pink/30"
                              onClick={() =>
                                track({
                                  event: 'AI_product_click',
                                  id: product.id,
                                  name: product.name,
                                  category: product.category,
                                })
                              }
                            >
                              {product.image_url ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={product.image_url}
                                  alt=""
                                  className="h-14 w-14 rounded-xl object-cover"
                                />
                              ) : (
                                <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/5 text-layali-pink/50">
                                  ✦
                                </span>
                              )}
                              <span className="min-w-0">
                                <span className="block truncate text-sm text-white">{product.name}</span>
                                <span className="block text-xs text-white/45">{product.reason}</span>
                                <span className="mt-1 block text-sm text-layali-gold-light">
                                  {formatPrice(product.price)}
                                </span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </div>
                ))
              )}
              {loading ? <p className="text-sm text-white/45">{t.assistant.thinking}</p> : null}
            </div>

            <form
              className="border-t border-white/8 p-3"
              onSubmit={(e) => {
                e.preventDefault();
                void send(query);
              }}
            >
              <label className="sr-only" htmlFor={`${panelId}-input`}>
                {t.assistant.placeholder}
              </label>
              <input
                id={`${panelId}-input`}
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t.assistant.placeholder}
                className="w-full rounded-full border border-white/12 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-layali-pink/40 focus:outline-none"
              />
              <p className="mt-2 px-1 text-[11px] leading-relaxed text-white/35">
                {t.assistant.disclaimer}
              </p>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

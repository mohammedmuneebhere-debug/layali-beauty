'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Send, Sparkles, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { formatPrice, cn } from '@/lib/utils';
import { track } from '@/lib/track';
import { toast } from '@/components/ui/Toast';
import { useCartStore } from '@/store/cart';
import { getRecentlyViewedHandles } from '@/lib/recently-viewed';
import type { AssistantComparison, AssistantProduct, AssistantReply } from '@/lib/assistant';

type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  products?: AssistantProduct[];
  comparison?: AssistantComparison | null;
  suggestions?: string[];
};

function productHandleFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/shop\/([^/?#]+)$/);
  if (!match?.[1]) return null;
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
}

function RichText({ text }: { text: string }) {
  const blocks = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-white/80">
      {blocks.map((line, index) => {
        if (!line.trim()) return <div key={index} className="h-1" />;
        const bullet = /^[•\-]\s+/.test(line);
        const content = bullet ? line.replace(/^[•\-]\s+/, '') : line;
        const parts = content.split(/(\*\*[^*]+\*\*)/g);
        const nodes = parts.map((part, i) =>
          part.startsWith('**') && part.endsWith('**') ? (
            <strong key={i} className="font-medium text-white">
              {part.slice(2, -2)}
            </strong>
          ) : (
            <span key={i}>{part}</span>
          )
        );
        return bullet ? (
          <p key={index} className="ps-3">
            <span className="me-2 text-layali-gold-light">•</span>
            {nodes}
          </p>
        ) : (
          <p key={index}>{nodes}</p>
        );
      })}
    </div>
  );
}

export function AskLayali() {
  const pathname = usePathname();
  const { t, locale } = useLanguage();
  const reduceMotion = useReducedMotion();
  const panelId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const addItem = useCartStore((s) => s.addItem);
  const cartLines = useCartStore((s) => s.lines);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [compareHandles, setCompareHandles] = useState<string[]>([]);
  const [compareProducts, setCompareProducts] = useState<AssistantProduct[]>([]);
  const [keyboardInset, setKeyboardInset] = useState(0);
  const [addingId, setAddingId] = useState<string | null>(null);

  const hidden =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/auth') ||
    pathname.startsWith('/checkout');

  const currentHandle = productHandleFromPath(pathname);
  const onProductDetail = Boolean(currentHandle);

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

  useEffect(() => {
    if (!open) return;
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const inset = Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop);
      setKeyboardInset(inset > 80 ? inset : 0);
    };
    sync();
    viewport.addEventListener('resize', sync);
    viewport.addEventListener('scroll', sync);
    return () => {
      viewport.removeEventListener('resize', sync);
      viewport.removeEventListener('scroll', sync);
    };
  }, [open]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [turns, loading, open]);

  const starterPrompts = useMemo(() => {
    const items = [t.assistant.suggestionFind, t.assistant.suggestionRecommend, t.assistant.suggestionDry];
    if (onProductDetail) items.unshift(t.assistant.suggestionThis);
    if (compareHandles.length >= 2) items.unshift(t.assistant.suggestionCompare);
    return [...new Set(items)].slice(0, 4);
  }, [t, onProductDetail, compareHandles.length]);

  if (hidden) return null;

  const toggleCompare = (product: AssistantProduct) => {
    setCompareHandles((prev) => {
      if (prev.includes(product.handle)) {
        setCompareProducts((cards) => cards.filter((p) => p.handle !== product.handle));
        return prev.filter((h) => h !== product.handle);
      }
      if (prev.length >= 3) return prev;
      setCompareProducts((cards) =>
        cards.some((p) => p.handle === product.handle) ? cards : [...cards, product]
      );
      return [...prev, product.handle];
    });
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || loading) return;
    setQuery('');
    const history = turns.slice(-8).map((turn) => ({ role: turn.role, text: turn.text }));
    setTurns((prev) => [...prev, { id: `u-${Date.now()}`, role: 'user', text: trimmed }]);
    setLoading(true);
    try {
      const lastProductHandles = [...turns]
        .reverse()
        .find((turn) => turn.role === 'assistant' && turn.products?.length)
        ?.products?.map((p) => p.handle);

      const res = await fetch('/api/assistant/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: trimmed,
          locale,
          history,
          context: {
            currentHandle,
            compareHandles,
            recentlyViewedHandles: getRecentlyViewedHandles(),
            lastProductHandles: lastProductHandles || [],
            cart: cartLines.slice(0, 8).map((line) => ({
              handle: line.productHandle,
              name: line.title,
            })),
          },
        }),
      });
      const json = (await res.json()) as AssistantReply & { error?: string };
      setTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: json.message || json.error || t.assistant.error,
          products: json.products || [],
          comparison: json.comparison,
          suggestions: json.suggestions,
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

  const handleAdd = async (product: AssistantProduct) => {
    if (!product.defaultVariantId || addingId) return;
    setAddingId(product.id);
    try {
      const ok = await addItem({
        id: product.id,
        type: 'product',
        name: product.name,
        price: product.price,
        image_url: product.image_url,
        merchandiseId: product.defaultVariantId,
      });
      if (ok) {
        toast(t.pdp.added);
        track({
          event: 'add_to_cart',
          id: product.id,
          name: product.name,
          category: product.category,
          value: product.price,
          currency: 'SAR',
        });
      } else {
        toast(t.pdp.addFailed);
      }
    } finally {
      setAddingId(null);
    }
  };

  const baseBottom = onProductDetail
    ? 'bottom-[calc(7.5rem+env(safe-area-inset-bottom,0px))] sm:bottom-20'
    : 'bottom-20';
  const teaserBottom = onProductDetail
    ? 'bottom-[calc(6.25rem+env(safe-area-inset-bottom,0px))] sm:bottom-5 max-sm:end-3 max-sm:min-w-12 max-sm:justify-center max-sm:px-3'
    : 'bottom-5';

  return (
    <>
      {!open ? (
      <button
        type="button"
        className={cn(
          'fixed end-4 z-[45] inline-flex min-h-12 items-center gap-2 rounded-full border border-layali-gold/30 bg-black/80 px-4 text-sm tracking-[0.08em] text-white shadow-[0_12px_40px_rgba(0,0,0,0.45)] backdrop-blur hover:border-layali-gold/60 focus-ring',
          teaserBottom
        )}
        style={keyboardInset ? { bottom: keyboardInset + 12 } : undefined}
        aria-label={t.assistant.open}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen(true);
          track({ event: 'AI_assistant_open' });
        }}
      >
        <Sparkles className="h-4 w-4 text-layali-gold-light" />
        <span className={onProductDetail ? 'max-sm:hidden' : undefined}>{t.assistant.teaser}</span>
      </button>
      ) : null}

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
              'fixed end-4 z-[45] flex max-h-[min(78dvh,36rem)] w-[min(92vw,24rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-layali-black/95 shadow-[0_24px_80px_rgba(0,0,0,0.5)]',
              'h-[min(70dvh,34rem)]',
              baseBottom
            )}
            style={
              keyboardInset
                ? { bottom: keyboardInset + (onProductDetail ? 72 : 16), maxHeight: 'min(70dvh, 34rem)' }
                : undefined
            }
          >
            <div className="flex items-center justify-between border-b border-white/8 px-4 py-3">
              <div>
                <p className="text-meta uppercase tracking-[0.16em] text-layali-gold-light">
                  {t.pdp.curated}
                </p>
                <h2 className="font-serif text-lg text-white">{t.assistant.title}</h2>
              </div>
              <div className="flex items-center gap-1">
                {turns.length > 0 ? (
                  <button
                    type="button"
                    className="px-2 text-[11px] uppercase tracking-[0.12em] text-white/45 hover:text-white"
                    onClick={() => setTurns([])}
                  >
                    {t.assistant.newChat}
                  </button>
                ) : null}
                <button
                  type="button"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-white/70 hover:text-white"
                  aria-label={t.assistant.close}
                  onClick={() => setOpen(false)}
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {compareProducts.length > 0 ? (
              <div className="flex items-center gap-2 overflow-x-auto border-b border-white/8 px-4 py-2">
                <span className="shrink-0 text-[11px] uppercase tracking-[0.12em] text-white/45">
                  {t.assistant.comparing}
                </span>
                {compareProducts.map((product) => (
                  <button
                    key={product.handle}
                    type="button"
                    className="shrink-0 rounded-full border border-white/12 px-2 py-1 text-[11px] text-white/80"
                    onClick={() => toggleCompare(product)}
                  >
                    {product.name.slice(0, 22)}
                  </button>
                ))}
                <button
                  type="button"
                  className="shrink-0 text-[11px] text-layali-gold-light"
                  onClick={() => {
                    setCompareHandles([]);
                    setCompareProducts([]);
                  }}
                >
                  {t.assistant.clearCompare}
                </button>
              </div>
            ) : null}

            <div ref={scrollerRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {turns.length === 0 ? (
                <div className="space-y-4">
                  <p className="text-sm leading-relaxed text-white/60">{t.assistant.empty}</p>
                  <div className="flex flex-wrap gap-2">
                    {starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="rounded-full border border-white/12 bg-white/[0.03] px-3 py-2 text-start text-xs text-white/75 hover:border-layali-pink/40"
                        onClick={() => void send(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                turns.map((turn) => (
                  <div key={turn.id} className={turn.role === 'user' ? 'text-end' : ''}>
                    {turn.role === 'user' ? (
                      <p className="inline-block rounded-2xl bg-white/10 px-3 py-2 text-sm text-white">
                        {turn.text}
                      </p>
                    ) : (
                      <RichText text={turn.text} />
                    )}
                    {turn.comparison && turn.comparison.columns.length >= 2 ? (
                      <div className="mt-3 overflow-x-auto rounded-2xl border border-white/8">
                        <table className="w-full min-w-[18rem] text-start text-[11px] text-white/70">
                          <thead>
                            <tr className="border-b border-white/8 text-white/90">
                              <th className="px-2 py-2 font-medium" />
                              {turn.comparison.columns.map((col) => (
                                <th key={col.handle} className="px-2 py-2 font-medium">
                                  {col.name}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {turn.comparison.rows.map((row) => (
                              <tr key={row.label} className="border-b border-white/5">
                                <td className="px-2 py-2 text-white/45">{row.label}</td>
                                {row.values.map((value, i) => (
                                  <td key={`${row.label}-${i}`} className="px-2 py-2">
                                    {value}
                                  </td>
                                ))}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {turn.comparison.pick ? (
                          <p className="px-3 py-2 text-xs text-layali-gold-light">
                            {t.assistant.myPick}: {turn.comparison.pick.name} — {turn.comparison.pick.reason}
                          </p>
                        ) : null}
                      </div>
                    ) : null}
                    {turn.products && turn.products.length > 0 ? (
                      <ul className="mt-3 space-y-2 text-start">
                        {turn.products.map((product) => {
                          const selected = compareHandles.includes(product.handle);
                          return (
                            <li key={product.id}>
                              <div className="rounded-2xl border border-white/8 bg-white/[0.03] p-2 hover:border-layali-pink/30">
                                <Link
                                  href={`/shop/${product.handle || product.id}`}
                                  className="flex gap-3"
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
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <Link
                                    href={`/shop/${product.handle || product.id}`}
                                    className="rounded-full border border-white/12 px-2.5 py-1 text-[11px] uppercase tracking-[0.1em] text-white/70"
                                  >
                                    {t.assistant.viewProduct}
                                  </Link>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/12 px-2.5 py-1 text-[11px] uppercase tracking-[0.1em] text-white/70 disabled:opacity-40"
                                    disabled={!product.available || !product.defaultVariantId || addingId === product.id}
                                    onClick={() => void handleAdd(product)}
                                  >
                                    {t.assistant.addToCart}
                                  </button>
                                  <button
                                    type="button"
                                    className={cn(
                                      'rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.1em]',
                                      selected
                                        ? 'border-layali-gold/50 text-layali-gold-light'
                                        : 'border-white/12 text-white/70'
                                    )}
                                    onClick={() => toggleCompare(product)}
                                  >
                                    {selected ? t.assistant.compared : t.assistant.compare}
                                  </button>
                                </div>
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                    {turn.role === 'assistant' && turn.suggestions?.length ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {turn.suggestions.slice(0, 3).map((prompt) => (
                          <button
                            key={prompt}
                            type="button"
                            className="rounded-full border border-white/10 px-3 py-1.5 text-[11px] text-white/55 hover:text-white"
                            onClick={() => void send(prompt)}
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))
              )}
              {loading ? <p className="text-sm text-white/45">{t.assistant.thinking}</p> : null}
            </div>

            <form
              className="border-t border-white/8 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]"
              onSubmit={(e) => {
                e.preventDefault();
                void send(query);
              }}
            >
              <label className="sr-only" htmlFor={`${panelId}-input`}>
                {t.assistant.placeholder}
              </label>
              <div className="flex items-center gap-2">
                <input
                  id={`${panelId}-input`}
                  ref={inputRef}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t.assistant.placeholder}
                  className="min-h-11 w-full rounded-full border border-white/12 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-white/35 focus:border-layali-pink/40 focus:outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full border border-layali-gold/30 text-layali-gold-light hover:border-layali-gold/60 disabled:opacity-40"
                  aria-label={t.assistant.send}
                  disabled={loading || !query.trim()}
                >
                  <Send className="h-4 w-4" />
                </button>
              </div>
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

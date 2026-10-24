'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

/**
 * Right-side hero campaign feature — embeds the Beauty, Redefined artwork
 * as a native Layali UI panel (label + frame + soft blend + restrained hover).
 * The poster is square, so the frame matches 1:1 and shows the full creative.
 * Artwork pixels are never modified.
 */
export function HeroCampaignFeature() {
  return (
    <Link
      href="/shop"
      prefetch
      aria-label="Layali Beauty, Redefined campaign — shop beauty essentials"
      className="group relative z-10 block w-full max-w-[min(100%,22rem)] justify-self-center focus-ring sm:max-w-[min(100%,24rem)] lg:max-w-[min(24rem,calc(100svh-15rem))] lg:justify-self-end xl:max-w-[min(26rem,calc(100svh-14rem))]"
    >
      {/* Ambient blend into the burgundy hero stage */}
      <span
        aria-hidden
        className="pointer-events-none absolute -inset-5 -z-10 rounded-[1.25rem] opacity-70 blur-2xl transition-opacity duration-500 group-hover:opacity-90"
        style={{
          background:
            'radial-gradient(ellipse 70% 65% at 55% 45%, rgba(212,46,124,0.22), rgba(26,8,14,0.08) 55%, transparent 72%)',
        }}
      />

      <div
        className="relative overflow-hidden rounded-sm border border-layali-pink/20 bg-[#120408]/55 shadow-[0_18px_48px_-28px_rgba(0,0,0,0.75)] transition-[border-color,box-shadow] duration-400 group-hover:border-layali-gold/35 group-hover:shadow-[0_22px_56px_-24px_rgba(212,46,124,0.28)]"
      >
        <div className="flex items-center justify-between gap-3 px-3.5 pt-2.5 pb-1.5">
          <p className="text-meta tracking-[0.16em] text-layali-gold-light/90 uppercase">
            Beauty, Redefined
          </p>
        </div>

        <div className="overflow-hidden px-2 pb-2 sm:px-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/ads/layali-promo-hero-beauty-redefined.jpg"
            alt="Layali Beauty, Redefined — beauty essentials styled against the Riyadh skyline"
            width={1024}
            height={1024}
            decoding="async"
            loading="eager"
            fetchPriority="high"
            draggable={false}
            className="block aspect-square h-auto w-full max-w-full rounded-[2px] object-contain object-center transition-transform duration-500 ease-out group-hover:scale-[1.015]"
          />
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-white/[0.08] px-3.5 py-2.5">
          <span className="text-meta tracking-[0.14em] uppercase text-white/40">
            The Layali Edit
          </span>
          <span className="inline-flex items-center gap-1.5 text-[0.65rem] tracking-[0.14em] uppercase text-white/70 transition-colors duration-300 group-hover:text-layali-pink-light sm:text-nav sm:tracking-[0.12em]">
            View Offer <ArrowRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
          </span>
        </div>
      </div>
    </Link>
  );
}

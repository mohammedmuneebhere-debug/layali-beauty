'use client';

import { useId } from 'react';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { cn } from '@/lib/utils';

function UkFlagIcon({ className }: { className?: string }) {
  const clipId = `uk-flag-${useId().replace(/:/g, '')}`;
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden>
      <clipPath id={clipId}>
        <rect width="60" height="30" rx="2" />
      </clipPath>
      <g clipPath={`url(#${clipId})`}>
        <rect width="60" height="30" fill="#012169" />
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#fff" strokeWidth="10" />
        <path d="M0 0 L60 30 M60 0 L0 30" stroke="#C8102E" strokeWidth="6" />
        <path d="M30 0 V30 M0 15 H60" stroke="#fff" strokeWidth="16" />
        <path d="M30 0 V30 M0 15 H60" stroke="#C8102E" strokeWidth="10" />
      </g>
    </svg>
  );
}

function KsaFlagIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 60 30" className={className} aria-hidden>
      <rect width="60" height="30" rx="2" fill="#006C35" />
      <text
        x="30"
        y="12.5"
        textAnchor="middle"
        fill="#fff"
        fontSize="6"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        لا إله إلا الله
      </text>
      <text
        x="30"
        y="19.2"
        textAnchor="middle"
        fill="#fff"
        fontSize="4.2"
        fontFamily="Georgia, 'Times New Roman', serif"
      >
        محمد رسول الله
      </text>
      <path d="M11 23.4 H49 L46 26 H14 Z" fill="#fff" />
    </svg>
  );
}

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      className={cn(
        'flex items-center rounded-full border border-layali-pink/25 p-0.5 text-meta font-medium tracking-wide shrink-0',
        className
      )}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={cn(
          'min-h-11 min-w-9 sm:min-w-11 rounded-full px-2 sm:px-3 py-2 transition-colors inline-flex items-center justify-center',
          locale === 'en'
            ? 'bg-layali-pink-glow text-white shadow-[0_0_12px_rgba(212,46,124,0.45)]'
            : 'text-white/55 hover:text-white'
        )}
        aria-label={t.lang.en}
        aria-pressed={locale === 'en'}
      >
        <UkFlagIcon className="h-3.5 w-[1.35rem] sm:h-4 sm:w-7 rounded-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.18)]" />
      </button>
      <button
        type="button"
        onClick={() => setLocale('ar')}
        className={cn(
          'min-h-11 min-w-9 sm:min-w-11 rounded-full px-2 sm:px-3 py-2 transition-colors inline-flex items-center justify-center',
          locale === 'ar'
            ? 'bg-layali-pink-glow text-white shadow-[0_0_12px_rgba(212,46,124,0.45)]'
            : 'text-white/55 hover:text-white'
        )}
        aria-label={t.lang.ar}
        aria-pressed={locale === 'ar'}
      >
        <KsaFlagIcon className="h-3.5 w-[1.35rem] sm:h-4 sm:w-7 rounded-[2px] shadow-[0_0_0_1px_rgba(255,255,255,0.18)]" />
      </button>
    </div>
  );
}

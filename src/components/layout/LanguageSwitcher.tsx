'use client';

import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      className={cn(
        'flex items-center rounded-full border border-layali-pink/25 p-0.5 text-meta font-medium tracking-wide',
        className
      )}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={cn(
          'min-w-11 min-h-11 rounded-full px-3 py-2 transition-colors inline-flex items-center justify-center',
          locale === 'en'
            ? 'bg-layali-pink-glow text-white shadow-[0_0_12px_rgba(212,46,124,0.45)]'
            : 'text-white/55 hover:text-white'
        )}
        aria-pressed={locale === 'en'}
      >
        {t.lang.en}
      </button>
      <button
        type="button"
        onClick={() => setLocale('ar')}
        className={cn(
          'min-w-11 min-h-11 rounded-full px-3 py-2 transition-colors inline-flex items-center justify-center',
          locale === 'ar'
            ? 'bg-layali-pink-glow text-white shadow-[0_0_12px_rgba(212,46,124,0.45)]'
            : 'text-white/55 hover:text-white'
        )}
        aria-pressed={locale === 'ar'}
      >
        {t.lang.ar}
      </button>
    </div>
  );
}

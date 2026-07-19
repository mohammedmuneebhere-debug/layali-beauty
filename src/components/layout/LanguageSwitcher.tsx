'use client';

import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { cn } from '@/lib/utils';

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale, t } = useLanguage();

  return (
    <div
      className={cn(
        'flex items-center rounded-full border border-layali-pink/25 p-0.5 text-[11px] font-medium tracking-wide',
        className
      )}
      role="group"
      aria-label="Language"
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={cn(
          'min-w-[36px] rounded-full px-2.5 py-1.5 transition-colors',
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
          'min-w-[36px] rounded-full px-2.5 py-1.5 transition-colors',
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

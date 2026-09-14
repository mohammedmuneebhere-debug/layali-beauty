'use client';

import {
  formatSaudiNationalInput,
  toStoredSaudiMobile,
} from '@/lib/address/saudi-phone';
import { cn } from '@/lib/utils';

type SaudiPhoneFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (stored: string) => void;
  placeholder?: string;
  error?: string;
  required?: boolean;
};

export function SaudiPhoneField({
  id,
  label,
  value,
  onChange,
  placeholder,
  error,
  required,
}: SaudiPhoneFieldProps) {
  const nationalDisplay = formatSaudiNationalInput(value);

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className="block text-meta font-medium tracking-[0.08em] mb-1.5 text-white/70"
      >
        {label}
      </label>
      <div
        className={cn(
          'flex items-stretch rounded-xl border bg-white/5 focus-within:ring-2 overflow-hidden',
          error
            ? 'border-red-400/60 focus-within:ring-red-400/40'
            : 'border-white/12 focus-within:ring-layali-pink/50 focus-within:border-layali-pink/40'
        )}
      >
        <span
          className="shrink-0 px-3 sm:px-4 flex items-center text-sm font-medium text-white/80 border-e border-white/12 bg-white/5 select-none"
          aria-hidden
        >
          +966
        </span>
        <input
          id={id}
          type="tel"
          inputMode="numeric"
          autoComplete="tel-national"
          required={required}
          aria-label={label}
          placeholder={placeholder}
          value={nationalDisplay}
          onChange={(e) => onChange(toStoredSaudiMobile(e.target.value))}
          className="min-w-0 flex-1 bg-transparent px-3 sm:px-4 py-3 text-white placeholder:text-white/30 focus:outline-none"
        />
      </div>
      {error ? <p className="mt-1 text-sm text-red-400">{error}</p> : null}
    </div>
  );
}

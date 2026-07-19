'use client';

import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
  tone?: 'dark' | 'light';
}

const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, label, error, options, placeholder, id, tone = 'dark', ...props }, ref) => {
    const isLight = tone === 'light';
    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={id}
            className={cn(
              'block text-sm font-medium mb-1.5',
              isLight ? 'text-gray-800' : 'text-white/70'
            )}
          >
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={id}
          className={cn(
            'w-full px-4 py-3 rounded-xl transition-all duration-200 appearance-none cursor-pointer focus:outline-none focus:ring-2',
            isLight
              ? 'border border-layali-pink/30 bg-white text-gray-900 focus:ring-layali-pink focus:border-transparent'
              : 'border border-white/12 bg-layali-surface text-white focus:ring-layali-pink/50 focus:border-layali-pink/40',
            error && (isLight ? 'border-red-400 focus:ring-red-400' : 'border-red-400/60 focus:ring-red-400/40'),
            className
          )}
          {...props}
        >
          {placeholder && (
            <option value="" className={isLight ? '' : 'bg-layali-surface text-white'}>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              className={isLight ? '' : 'bg-layali-surface text-white'}
            >
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className={cn('mt-1 text-sm', isLight ? 'text-red-500' : 'text-red-400')}>{error}</p>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';
export { Select };

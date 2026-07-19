'use client';

import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  tone?: 'dark' | 'light';
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, id, tone = 'dark', ...props }, ref) => {
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
        <input
          ref={ref}
          id={id}
          className={cn(
            'w-full px-4 py-3 rounded-xl transition-all duration-200 focus:outline-none focus:ring-2',
            isLight
              ? 'border border-layali-pink/30 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-layali-pink focus:border-transparent'
              : 'border border-white/12 bg-white/5 text-white placeholder:text-white/30 focus:ring-layali-pink/50 focus:border-layali-pink/40',
            error && (isLight ? 'border-red-400 focus:ring-red-400' : 'border-red-400/60 focus:ring-red-400/40'),
            className
          )}
          {...props}
        />
        {error && (
          <p className={cn('mt-1 text-sm', isLight ? 'text-red-500' : 'text-red-400')}>{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
export { Input };

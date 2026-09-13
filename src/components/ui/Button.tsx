'use client';

import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'gold';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', loading, children, disabled, ...props }, ref) => {
    const variants = {
      primary:
        'bg-layali-pink-glow text-white hover:bg-layali-pink shadow-[0_0_20px_rgba(212,46,124,0.35)] btn-glow',
      secondary:
        'bg-white/8 text-white border border-white/15 hover:bg-white/12 hover:border-layali-pink/40',
      outline:
        'border border-layali-pink/60 text-white hover:bg-layali-pink/10 hover:border-layali-pink hover:shadow-[0_0_24px_rgba(212,46,124,0.3)]',
      ghost: 'text-white/70 hover:text-white hover:bg-white/5',
      gold: 'bg-gradient-to-r from-layali-gold to-layali-gold-light text-layali-void hover:opacity-90 shadow-lg',
    };

    const sizes = {
      sm: 'px-4 py-2 text-xs tracking-[0.1em]',
      md: 'px-6 py-3 text-sm tracking-[0.1em]',
      lg: 'px-8 py-3.5 text-sm tracking-[0.12em]',
    };

    return (
      <button
        ref={ref}
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-full font-sans font-medium uppercase transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed',
          variants[variant],
          sizes[size],
          className
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
              fill="none"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        )}
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export { Button };

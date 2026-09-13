import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number, currency = 'SAR') {
  return new Intl.NumberFormat('en-SA', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price);
}

export function formatDate(date: string, locale: string = 'en-US') {
  const resolved = locale.startsWith('ar') ? 'ar-SA-u-ca-gregory' : locale;
  return new Intl.DateTimeFormat(resolved, {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).format(new Date(date));
}

export function generateOrderId() {
  return `LAY-${Date.now().toString(36).toUpperCase()}`;
}

import { toAsciiDigits } from '@/lib/address/structured';

function digitsOnly(value: string): string {
  return toAsciiDigits(value).replace(/\D/g, '');
}

/**
 * National Saudi mobile digits (typically 9 digits starting with 5).
 * Strips +966 / 00966 / 966 / leading 0 without duplicating the country code.
 */
export function saudiNationalMobileDigits(value: string): string {
  let digits = digitsOnly(value);
  for (let i = 0; i < 3; i += 1) {
    if (digits.startsWith('00966')) digits = digits.slice(5);
    else if (digits.startsWith('966')) digits = digits.slice(3);
    else if (digits.startsWith('0')) digits = digits.slice(1);
    else break;
  }
  return digits.slice(0, 9);
}

export function toStoredSaudiMobile(value: string): string {
  const national = saudiNationalMobileDigits(value);
  return national ? `+966${national}` : '';
}

export function isValidSaudiMobile(value: string): boolean {
  return /^5\d{8}$/.test(saudiNationalMobileDigits(value));
}

/** Grouped national digits for the editable input: 5X XXX XXXX */
export function formatSaudiNationalInput(value: string): string {
  const n = saudiNationalMobileDigits(value);
  if (n.length <= 2) return n;
  if (n.length <= 5) return `${n.slice(0, 2)} ${n.slice(2)}`;
  return `${n.slice(0, 2)} ${n.slice(2, 5)} ${n.slice(5)}`;
}

export function formatSaudiPhoneDisplay(value: string): string {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const national = saudiNationalMobileDigits(raw);
  if (/^5\d{8}$/.test(national)) {
    return `+966 ${national.slice(0, 2)} ${national.slice(2, 5)} ${national.slice(5)}`;
  }
  if (national.length >= 8) return `+966 ${national}`;
  return raw;
}

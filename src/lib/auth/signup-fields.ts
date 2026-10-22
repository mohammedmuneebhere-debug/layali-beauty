import { isValidSaudiMobile, toStoredSaudiMobile } from '@/lib/address/saudi-phone';

export type SignupDraft = {
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
};

export type SignupFieldErrors = {
  fullName?: string;
  phone?: string;
  email?: string;
};

const EMAIL = /^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i;

function cleanName(value: unknown): string {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();
}

function splitSignupName(name: string): { firstName: string; lastName: string } {
  const parts = name.split(' ').filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || '', lastName: parts[0] || '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export function normalizeSignupDraft(input: {
  fullName?: unknown;
  phone?: unknown;
  email?: unknown;
}): { ok: true; draft: SignupDraft } | { ok: false; errors: SignupFieldErrors } {
  const errors: SignupFieldErrors = {};
  const fullName = cleanName(input.fullName);
  if (fullName.length < 2 || fullName.length > 80 || !/\p{L}/u.test(fullName)) {
    errors.fullName = 'Enter your full name.';
  }
  const phone = toStoredSaudiMobile(String(input.phone ?? ''));
  if (!isValidSaudiMobile(String(input.phone ?? ''))) {
    errors.phone = 'Enter a valid Saudi mobile number.';
  }
  const email = String(input.email ?? '').trim().toLowerCase();
  if (email.length > 254 || !EMAIL.test(email) || email.includes('..')) {
    errors.email = 'Enter a valid email address.';
  }
  if (errors.fullName || errors.phone || errors.email) return { ok: false, errors };
  const person = splitSignupName(fullName);
  return {
    ok: true,
    draft: {
      email,
      firstName: person.firstName,
      lastName: person.lastName,
      phone,
    },
  };
}

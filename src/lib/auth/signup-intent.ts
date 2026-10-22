/**
 * Sealed pending signup profile.
 * The cookie holds name and phone until the Customer Account API returns
 * the same verified email. Phone writes use the customer profile metafield,
 * which requires Shopify Admin credentials. A missing Admin configuration
 * still saves the name and leaves the redirect intact.
 */
import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { normalizeSignupDraft, type SignupDraft } from '@/lib/auth/signup-fields';

export const SIGNUP_INTENT_MAX_AGE_SECONDS = 600;

export type SignupIntent = SignupDraft & { expMs: number };

export type SignupApplyResult = 'absent' | 'mismatch' | 'applied' | 'name_failed';

type StoredIntent = SignupIntent & { v: 1 };

function keyFromSecret(secret: string): Buffer {
  return createHash('sha256').update(`layali-signup-intent\0${secret}`).digest();
}

export function sealSignupIntent(draft: SignupDraft, secret: string, now = Date.now()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', keyFromSecret(secret), iv);
  const payload: StoredIntent = { v: 1, ...draft, expMs: now + SIGNUP_INTENT_MAX_AGE_SECONDS * 1000 };
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), body.toString('base64url')].join('.');
}

export function openSignupIntent(sealed: string, secret: string, now = Date.now()): SignupIntent | null {
  const parts = sealed.split('.');
  if (parts.length !== 4 || parts[0] !== 'v1' || !secret) return null;
  try {
    const iv = Buffer.from(parts[1], 'base64url');
    const tag = Buffer.from(parts[2], 'base64url');
    const data = Buffer.from(parts[3], 'base64url');
    if (iv.length !== 12 || tag.length !== 16 || data.length === 0) return null;
    const decipher = createDecipheriv('aes-256-gcm', keyFromSecret(secret), iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
    const parsed = JSON.parse(json) as Partial<StoredIntent>;
    if (parsed.v !== 1 || !Number.isFinite(parsed.expMs) || Number(parsed.expMs) <= now) return null;
    const draft = normalizeSignupDraft({
      fullName: `${parsed.firstName || ''} ${parsed.lastName || ''}`.trim(),
      phone: parsed.phone,
      email: parsed.email,
    });
    if (!draft.ok) return null;
    if (draft.draft.firstName !== parsed.firstName || draft.draft.lastName !== parsed.lastName) return null;
    if (draft.draft.phone !== parsed.phone || draft.draft.email !== parsed.email) return null;
    return { ...draft.draft, expMs: Number(parsed.expMs) };
  } catch {
    return null;
  }
}

export function signupEmailMatches(pendingEmail: string, verifiedEmail: string): boolean {
  const pending = Buffer.from(pendingEmail);
  const verified = Buffer.from(verifiedEmail.trim().toLowerCase());
  if (pending.length === 0 || pending.length !== verified.length) return false;
  return timingSafeEqual(pending, verified);
}

export async function applySignupIntent(input: {
  intent: SignupIntent | null;
  verifiedEmail: string;
  updateName: (firstName: string, lastName: string) => Promise<void>;
  persistPhone: ((phone: string) => Promise<void>) | null;
}): Promise<SignupApplyResult> {
  if (!input.intent) return 'absent';
  if (!signupEmailMatches(input.intent.email, input.verifiedEmail)) return 'mismatch';
  try {
    await input.updateName(input.intent.firstName, input.intent.lastName);
  } catch {
    console.error('Signup name update failed');
    return 'name_failed';
  }
  if (!input.persistPhone) {
    console.error('Signup phone save skipped because Shopify Admin is not configured');
    return 'applied';
  }
  try {
    await input.persistPhone(input.intent.phone);
  } catch {
    console.error('Signup phone save failed');
  }
  return 'applied';
}

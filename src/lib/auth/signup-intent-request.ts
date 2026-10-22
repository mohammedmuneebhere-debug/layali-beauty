import { customerAccountSignupStartPath } from '@/lib/auth/customer-account-start';
import { normalizeInternalPath, type RedirectHostHeaders } from '@/lib/auth/navigate-after-auth';
import { normalizeSignupDraft } from '@/lib/auth/signup-fields';
import { sealSignupIntent, SIGNUP_INTENT_MAX_AGE_SECONDS } from '@/lib/auth/signup-intent';
import { trustedSignupOrigin } from '@/lib/auth/signup-origin';
import { CUSTOMER_ACCOUNT_SIGNUP_COOKIE } from '@/lib/shopify/customer-account-cookie';
import { customerAccountConfig } from '@/lib/shopify/customer-account';

export type SignupIntentCookie = {
  name: string;
  value: string;
  maxAge: number;
};

export type SignupIntentResult = {
  status: number;
  body: { error?: string; errors?: unknown; nextPath?: string };
  cookie: SignupIntentCookie | null;
};

type SignupBody = {
  fullName?: unknown;
  phone?: unknown;
  email?: unknown;
  returnTo?: unknown;
};

/**
 * Decides the signup response before any cookie is written.
 * An untrusted Origin returns 403 with no cookie and does not read the body.
 */
export async function handleSignupIntent(input: {
  requestUrl: string;
  originHeader: string | null;
  headers?: RedirectHostHeaders;
  readBody: () => Promise<unknown>;
  env?: NodeJS.ProcessEnv;
}): Promise<SignupIntentResult> {
  const env = input.env ?? process.env;
  if (!trustedSignupOrigin(input.requestUrl, input.originHeader, input.headers, env)) {
    return { status: 403, body: { error: 'Forbidden' }, cookie: null };
  }
  const gate = customerAccountConfig(env);
  if (!gate.ok) {
    return { status: 503, body: { error: 'Sign-in is temporarily unavailable' }, cookie: null };
  }
  const body = (await input.readBody().catch(() => null)) as SignupBody | null;
  const parsed = normalizeSignupDraft({
    fullName: body?.fullName,
    phone: body?.phone,
    email: body?.email,
  });
  if (!parsed.ok) {
    return { status: 400, body: { errors: parsed.errors }, cookie: null };
  }
  const returnTo = normalizeInternalPath(typeof body?.returnTo === 'string' ? body.returnTo : null);
  return {
    status: 200,
    body: { nextPath: customerAccountSignupStartPath(returnTo) },
    cookie: {
      name: CUSTOMER_ACCOUNT_SIGNUP_COOKIE,
      value: sealSignupIntent(parsed.draft, gate.config.sessionSecret),
      maxAge: SIGNUP_INTENT_MAX_AGE_SECONDS,
    },
  };
}

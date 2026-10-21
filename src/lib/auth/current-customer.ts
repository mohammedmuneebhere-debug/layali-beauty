/**
 * Verified Shopify customer for server routes.
 * Email and customer id come from the Customer Account API, not the request body.
 */
import { cookies } from 'next/headers';
import { SITE_URL } from '@/lib/constants';
import { isAllowlistedStaff } from '@/lib/auth/staff-allowlist';
import { sessionCookieWriteDecision } from '@/lib/auth/session-cookie-write';
import { customerAccountConfig } from '@/lib/shopify/customer-account';
import {
  resolveCustomerAccountSession,
  type FlowCookie,
} from '@/lib/shopify/customer-account-flow';
import { readPackedSession } from '@/lib/shopify/customer-account-session';
import { fetchAccountCustomer } from '@/lib/shopify/customer-account-api';
import { readCustomerJson } from '@/lib/shopify/shop-records';

export type ProfileExtras = {
  city?: string | null;
  country?: string | null;
  gender?: 'female' | 'male' | null;
  phone?: string | null;
  onboardingCompleted?: boolean;
};

export type StorefrontCustomer = {
  id: string;
  email: string;
  fullName: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  city: string | null;
  country: string | null;
  gender: 'female' | 'male' | null;
  onboardingCompleted: boolean;
  staff: boolean;
};

export type CustomerContext =
  | { signedIn: false; configured: boolean }
  | { signedIn: true; configured: true; accessToken: string; customer: StorefrontCustomer };

const COOKIE_BASE = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax' as const,
  path: '/',
};

/**
 * Writes refreshed or cleared session cookies.
 * Call this from a Route Handler only. Server Components cannot set cookies.
 */
export async function persistSessionCookies(flowCookies: FlowCookie[]): Promise<void> {
  if (!flowCookies.length) return;
  const jar = await cookies();
  for (const cookie of flowCookies) {
    jar.set(cookie.name, cookie.value, { ...COOKIE_BASE, maxAge: cookie.maxAge });
  }
}

/** True when a Route Handler must refresh or clear the sealed session cookie. */
export async function sealedSessionNeedsCookieWrite(): Promise<boolean> {
  const gate = customerAccountConfig(process.env);
  if (!gate.ok) return false;
  const jar = await cookies();
  const session = readPackedSession(
    jar.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value })),
    gate.config.sessionSecret
  );
  return sessionCookieWriteDecision(session, Date.now()) === 'commit';
}

export async function readCustomerSession(): Promise<{
  configured: boolean;
  accessToken: string | null;
  cookiesToSet: FlowCookie[];
}> {
  const gate = customerAccountConfig(process.env);
  if (!gate.ok) return { configured: false, accessToken: null, cookiesToSet: [] };
  const jar = await cookies();
  const resolved = await resolveCustomerAccountSession({
    requestUrl: `${SITE_URL}/api/customer-account/session`,
    cookies: jar.getAll().map((cookie) => ({ name: cookie.name, value: cookie.value })),
    env: process.env,
  });
  return {
    configured: true,
    accessToken: resolved.session?.accessToken || null,
    cookiesToSet: resolved.result.cookies,
  };
}

export async function customerContextForAccessToken(
  configured: boolean,
  accessToken: string | null
): Promise<CustomerContext> {
  if (!configured || !accessToken) {
    return { signedIn: false, configured };
  }
  try {
    const account = await fetchAccountCustomer(accessToken);
    const extras = (await readCustomerJson<ProfileExtras>(account.id, 'profile')) || {};
    const fullName = [account.firstName, account.lastName].filter(Boolean).join(' ').trim() || account.email;
    return {
      signedIn: true,
      configured: true,
      accessToken,
      customer: {
        id: account.id,
        email: account.email,
        fullName,
        firstName: account.firstName,
        lastName: account.lastName,
        phone: extras.phone || account.phone,
        city: extras.city || null,
        country: extras.country || null,
        gender: extras.gender || null,
        onboardingCompleted: extras.onboardingCompleted === true,
        staff: isAllowlistedStaff(account.email),
      },
    };
  } catch (err) {
    console.error('Customer Account profile failed', err instanceof Error ? err.message : 'error');
    return { signedIn: false, configured: true };
  }
}

export async function getCustomerContext(): Promise<CustomerContext> {
  const session = await readCustomerSession();
  // Route Handlers may persist a refresh. Server Component callers must redirect
  // to /api/customer-account/commit-session before this when a write is needed.
  if (session.cookiesToSet.length) {
    await persistSessionCookies(session.cookiesToSet);
  }
  return customerContextForAccessToken(session.configured, session.accessToken);
}

export function customerPublic(customer: StorefrontCustomer) {
  return {
    id: customer.id,
    email: customer.email,
    fullName: customer.fullName,
    phone: customer.phone,
    city: customer.city,
    country: customer.country,
    gender: customer.gender,
    onboardingCompleted: customer.onboardingCompleted,
    staff: customer.staff,
  };
}

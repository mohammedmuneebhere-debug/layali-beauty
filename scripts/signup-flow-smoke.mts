/**
 * Sign Up must use the Shopify Customer Account start flow.
 * No live Shopify or Supabase calls.
 *
 * Usage: npm run test:signup
 */
import fs from 'node:fs';
import path from 'node:path';
import { customerAccountStartUrl, customerAccountSignupStartPath, isCustomerAccountSignupStartPath } from '@/lib/auth/customer-account-start';
import { normalizeSignupDraft } from '@/lib/auth/signup-fields';
import { applySignupIntent, openSignupIntent, sealSignupIntent } from '@/lib/auth/signup-intent';
import { buildAuthorizeUrl, CUSTOMER_ACCOUNT_START_PATH } from '@/lib/shopify/customer-account';
import {
  clearCustomerAccountDiscoveryCache,
  handleCustomerAccountStart,
} from '@/lib/shopify/customer-account-flow';

const DOMAIN = 'new-store.myshopify.com';
const SHOP_ID = '123456';
const ORIGIN = 'https://www.layalibeautystore.com';
const STAGING = 'https://layali-preview.vercel.app';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

function filesUnder(dir: string): string[] {
  return fs
    .readdirSync(dir, { recursive: true })
    .map((entry) => path.join(dir, String(entry)))
    .filter((file) => fs.existsSync(file) && fs.statSync(file).isFile() && /\.(ts|tsx)$/.test(file));
}

const AUTH_CALL = /\/auth\/v1|supabase\.auth|auth\.resend|auth\.signUp|auth\.verifyOtp|signInWithOtp|@supabase\/|createBrowserClient/;

function source(relativePath: string): string {
  return fs.readFileSync(relativePath, 'utf8');
}

const signupPage = source('src/app/auth/signup/page.tsx');
const signInPage = source('src/app/auth/signin/page.tsx');
const form = source('src/app/auth/signin/sign-in-form.tsx');
const startRoute = source('src/app/api/customer-account/start/route.ts');
const respond = source('src/app/api/customer-account/respond.ts');
const authSources = [
  ...filesUnder('src/app/auth'),
  ...filesUnder('src/app/api/customer-account'),
  ...filesUnder('src/components'),
].map((file) => source(file));

assert('signup page renders the shared account form', signupPage.includes('SignUpForm') && !AUTH_CALL.test(signupPage));
assert('sign-in page renders the shared account form', signInPage.includes('SignInForm') && !AUTH_CALL.test(signInPage));
assert(
  'signup and sign-in both enter Shopify Customer Accounts',
  form.includes('customerAccountStartUrl') &&
    form.includes("fetch('/api/customer-account/signup-intent'") &&
    form.includes('name="fullName"') &&
    form.includes('name="phone"') &&
    form.includes('name="email"') &&
    form.includes('Create account with email') &&
    form.includes('Email me a sign-in code') &&
    !form.includes('type="password"') &&
    !AUTH_CALL.test(form)
);
assert('auth UI has no Supabase Auth calls', authSources.every((text) => !AUTH_CALL.test(text)));
assert(
  'start route delegates to the Shopify Customer Account handler',
  startRoute.includes('handleCustomerAccountStart') && !AUTH_CALL.test(startRoute)
);

const checkoutStart = customerAccountStartUrl(ORIGIN, '/checkout');
const signupStart = customerAccountStartUrl(STAGING, '/survey');
const blockedStart = customerAccountStartUrl(ORIGIN, '//evil.example/auth/v1/resend');
assert('sign-in and signup share the Customer Account start path', CUSTOMER_ACCOUNT_START_PATH === '/api/customer-account/start');
assert('internal return paths stay on the start URL', checkoutStart === `${ORIGIN}/api/customer-account/start?return=%2Fcheckout`);
assert('signup uses the same start URL on the staging origin', signupStart === `${STAGING}/api/customer-account/start?return=%2Fsurvey`);
assert('external return targets are not forwarded', blockedStart === `${ORIGIN}/api/customer-account/start` && !blockedStart.includes('auth/v1'));

const calls: string[] = [];
const fetchImpl: typeof fetch = async (input) => {
  const url = String(input);
  calls.push(url);
  if (url.endsWith('/.well-known/openid-configuration')) {
    return Response.json({
      issuer: `https://shopify.com/authentication/${SHOP_ID}`,
      authorization_endpoint: `https://${DOMAIN}/authentication/oauth/authorize`,
      token_endpoint: `https://${DOMAIN}/authentication/oauth/token`,
      end_session_endpoint: `https://${DOMAIN}/authentication/logout`,
      jwks_uri: `https://${DOMAIN}/authentication/.well-known/jwks.json`,
    });
  }
  return new Response('missing', { status: 404 });
};

clearCustomerAccountDiscoveryCache();
const started = await handleCustomerAccountStart({
  requestUrl: signupStart,
  env: {
    SHOPIFY_STORE_DOMAIN: DOMAIN,
    SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: 'public-client',
    SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: SHOP_ID,
    SHOPIFY_CUSTOMER_ACCOUNT_SESSION_SECRET: 's'.repeat(40),
    LAYALI_STAGING_ORIGIN: STAGING,
  },
  fetchImpl,
});

const middleware = source('src/middleware.ts');
assert(
  'start route is a registered GET handler',
  startRoute.includes("export const dynamic = 'force-dynamic'") &&
    startRoute.includes('export async function GET') &&
    startRoute.includes('handleCustomerAccountStart') &&
    startRoute.includes('flowToResponse')
);
assert(
  'middleware does not intercept the customer-account start route',
  middleware.includes('api/customer-account')
);
assert(
  'a handler 404 is the public JSON body, not the site 404 page',
  respond.includes("if (result.status === 404) return { error: 'Not found' };")
);

clearCustomerAccountDiscoveryCache();
const unconfigured = await handleCustomerAccountStart({
  requestUrl: `${STAGING}/api/customer-account/start`,
  env: {},
  fetchImpl,
});
assert(
  'staging start without Customer Account env is the handler 404',
  unconfigured.status === 404 && unconfigured.reason === 'not_configured' && !unconfigured.location
);

clearCustomerAccountDiscoveryCache();
const otherPreview = await handleCustomerAccountStart({
  requestUrl: 'https://layali-beauty-preview.vercel.app/api/customer-account/start',
  env: {
    SHOPIFY_STORE_DOMAIN: DOMAIN,
    SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: 'public-client',
    SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: SHOP_ID,
    SHOPIFY_CUSTOMER_ACCOUNT_SESSION_SECRET: 's'.repeat(40),
    LAYALI_STAGING_ORIGIN: STAGING,
  },
  fetchImpl,
});
assert(
  'a different preview hostname stays denied after configuration',
  otherPreview.status === 404 && otherPreview.reason === 'wrong_host'
);

assert('signup start redirects to Shopify authorization', started.status === 302 && started.reason === 'authorize');
assert(
  'signup verification is Shopify email code, not Supabase',
  Boolean(started.location?.startsWith(`https://${DOMAIN}/authentication/oauth/authorize`)) &&
    !started.location?.includes('login_hint') &&
    calls.length === 1 &&
    calls[0].includes(DOMAIN) &&
    calls.every((url) => !url.includes('supabase') && !url.includes('/auth/v1'))
);

const hinted = await handleCustomerAccountStart({
  requestUrl: `${ORIGIN}/api/customer-account/start?signup=1`,
  env: {
    SHOPIFY_STORE_DOMAIN: DOMAIN,
    SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: 'public-client',
    SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: SHOP_ID,
    SHOPIFY_CUSTOMER_ACCOUNT_SESSION_SECRET: 's'.repeat(40),
  },
  fetchImpl,
  loginHint: 'layla@example.com',
});
const hintedUrl = new URL(hinted.location || 'https://invalid.example');
assert('signup passes login_hint to Shopify and keeps PKCE', hinted.status === 302 && hintedUrl.searchParams.get('login_hint') === 'layla@example.com' && hintedUrl.searchParams.get('code_challenge_method') === 'S256');

const secret = 's'.repeat(40);
const draft = normalizeSignupDraft({ fullName: 'Layla Nasser', phone: '0551234567', email: 'Layla@Example.com' });
assert('signup fields normalize name, Saudi phone, and email', draft.ok && draft.draft.email === 'layla@example.com' && draft.draft.phone === '+966551234567' && draft.draft.firstName === 'Layla' && draft.draft.lastName === 'Nasser');
assert('signup rejects an invalid email', normalizeSignupDraft({ fullName: 'Layla Nasser', phone: '0551234567', email: 'not-an-email' }).ok === false);
const sealed = draft.ok ? sealSignupIntent(draft.draft, secret, 1_000) : '';
const opened = openSignupIntent(sealed, secret, 1_000);
assert('pending signup cookie round-trips without exposing the seal format to the client', Boolean(opened && opened.email === 'layla@example.com' && opened.phone === '+966551234567'));
assert('expired signup details are dropped', openSignupIntent(sealed, secret, 1_000 + 601_000) === null);
const tampered = sealed.split('');
const flipAt = sealed.lastIndexOf('.') + 2;
tampered[flipAt] = tampered[flipAt] === 'a' ? 'b' : 'a';
assert('a tampered signup cookie is dropped', openSignupIntent(tampered.join(''), secret, 1_000) === null);
assert('a signup cookie opened with the wrong secret is dropped', openSignupIntent(sealed, 't'.repeat(40), 1_000) === null);

const names: string[] = [];
const phones: string[] = [];
const matched = await applySignupIntent({
  intent: opened,
  verifiedEmail: 'Layla@Example.com',
  updateName: async (firstName, lastName) => {
    names.push(`${firstName} ${lastName}`);
  },
  persistPhone: async (phone) => {
    phones.push(phone);
  },
});
const mismatched = await applySignupIntent({
  intent: opened,
  verifiedEmail: 'other@example.com',
  updateName: async () => {
    names.push('mismatch');
  },
  persistPhone: async () => {
    phones.push('mismatch');
  },
});
let nameFailedCalls = 0;
const nameFailed = await applySignupIntent({
  intent: opened,
  verifiedEmail: 'layla@example.com',
  updateName: async () => {
    throw new Error('upstream');
  },
  persistPhone: async () => {
    nameFailedCalls += 1;
  },
});
const phoneSkipped = await applySignupIntent({
  intent: opened,
  verifiedEmail: 'layla@example.com',
  updateName: async () => undefined,
  persistPhone: null,
});
const signupPath = customerAccountSignupStartPath('/cart');
const hostileAuthorize = buildAuthorizeUrl({
  authorizationEndpoint: `https://${DOMAIN}/authentication/oauth/authorize`,
  storeDomain: DOMAIN,
  clientId: 'public-client',
  redirectUri: `${ORIGIN}/api/customer-account/callback`,
  state: 'state-value-with-enough-bytes',
  nonce: 'nonce-value',
  codeChallenge: 'challenge',
  loginHint: 'layla@example.com\r\nhttps://evil.example',
});
assert('matching verified email applies the name and phone', matched === 'applied' && names.includes('Layla Nasser') && phones.includes('+966551234567') && !phones.includes('mismatch') && !names.includes('mismatch'));
assert('a different verified email does not apply pending details', mismatched === 'mismatch');
assert('a failed name update does not write the phone', nameFailed === 'name_failed' && nameFailedCalls === 0);
assert('missing Admin credentials still allow the name update', phoneSkipped === 'applied');
assert('signup start path is internal and marked as signup', isCustomerAccountSignupStartPath(signupPath) && signupPath.startsWith('/api/customer-account/start?') && !isCustomerAccountSignupStartPath('https://evil.example/api/customer-account/start?signup=1'));
assert('a hostile login hint is omitted', !hostileAuthorize.includes('login_hint') && !hostileAuthorize.includes('evil.example'));

const continueRoute = source('src/app/api/customer-account/continue/route.ts');
const intentRoute = source('src/app/api/customer-account/signup-intent/route.ts');
assert(
  'continue applies the sealed signup cookie only after the customer session exists',
  continueRoute.includes('applySignupIntent') &&
    continueRoute.includes('verifiedEmail: context.customer.email') &&
    continueRoute.includes('CUSTOMER_ACCOUNT_SIGNUP_COOKIE') &&
    intentRoute.includes('httpOnly: true') &&
    intentRoute.includes('sealSignupIntent') &&
    !intentRoute.includes('login_hint')
);

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('signup flow checks passed');

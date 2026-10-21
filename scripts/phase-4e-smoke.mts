/**
 * Phase 4E checks. No Shopify calls, no orders, no secrets from env files.
 *
 * Usage: npm run test:phase-4e
 */
import { staffAccessDecision } from '@/lib/auth/staff-access';
import { assessDeliveryCharge } from '@/lib/checkout/delivery-charge';
import { orderEmailDecision } from '@/lib/email/order-email-access';
import {
  accessTokenExpired,
  assertAuthorizationEndpoint,
  buildAuthorizeUrl,
  callbackUrl,
  createPkceVerifier,
  customerAccountConfig,
  customerAccountHostDecision,
  customerCanAccessOrder,
  oauthStateMatches,
  pkceS256Challenge,
  tokenRequestBody,
} from '@/lib/shopify/customer-account';

const SECRET = 's'.repeat(40);
let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

function accountEnv(overrides?: { clientId?: string; shopId?: string }): NodeJS.ProcessEnv {
  return {
    SHOPIFY_STORE_DOMAIN: 'new-store.myshopify.com',
    SHOPIFY_CUSTOMER_ACCOUNT_CLIENT_ID: overrides?.clientId ?? 'public-client',
    SHOPIFY_CUSTOMER_ACCOUNT_SHOP_ID: overrides?.shopId ?? '123456',
    SHOPIFY_CUSTOMER_ACCOUNT_SESSION_SECRET: SECRET,
    SHOPIFY_CLIENT_SECRET: 'must-not-enable-accounts',
    VERCEL_ENV: 'production',
  };
}

const open = customerAccountConfig(accountEnv());
assert('production customer-account env can enable accounts', open.ok === true);
assert(
  'the customer-account origin is the live site',
  open.ok && open.config.origin === 'https://www.layalibeautystore.com'
);
assert('a missing client id stays disabled', customerAccountConfig(accountEnv({ clientId: '' })).ok === false);
assert('localhost is not a customer-account host', customerAccountHostDecision('localhost:3000') === 'deny');
assert('the live www host is allowed', customerAccountHostDecision('www.layalibeautystore.com') === 'allow');
assert('a non-numeric shop id is rejected', customerAccountConfig(accountEnv({ shopId: 'gid://shopify/Shop/1' })).ok === false);

const verifier = createPkceVerifier();
const challenge = pkceS256Challenge(verifier);
assert('pkce challenge is not the verifier', challenge !== verifier && challenge.length > 20);
const state = 'state-value-with-enough-bytes';
assert('matching oauth state is accepted', oauthStateMatches(state, state));
assert('mismatched oauth state is rejected', oauthStateMatches(state, `${state}x`) === false);

assert('a token inside the skew window is expired', accessTokenExpired(1_000, 980, 30));
assert('a token outside the skew window is current', accessTokenExpired(10_000, 1_000, 30) === false);

assert('a browser customer id is not ownership', customerCanAccessOrder(null, 'gid://shopify/Customer/1', 'gid://shopify/Customer/1') === false);
assert('session and order customer must match', customerCanAccessOrder('gid://shopify/Customer/1', 'gid://shopify/Customer/1', 'gid://shopify/Customer/9'));
assert('a different order customer is denied', customerCanAccessOrder('gid://shopify/Customer/1', 'gid://shopify/Customer/2') === false);

const redirectUri = callbackUrl('https://staging.example.com');
const authorize = buildAuthorizeUrl({
  authorizationEndpoint: 'https://shopify.com/authentication/123456/oauth/authorize',
  storeDomain: 'new-store.myshopify.com',
  clientId: 'public-client',
  redirectUri,
  state,
  nonce: 'nonce-value',
  codeChallenge: challenge,
});
assert('authorize url uses the staging callback', authorize.includes(encodeURIComponent(redirectUri)));
assert('authorize url asks for S256 pkce', authorize.includes('code_challenge_method=S256'));
assert('authorize url does not carry the verifier', !authorize.includes(verifier));
let rejectedForeign = false;
try {
  assertAuthorizationEndpoint('https://evil.example/oauth', 'new-store.myshopify.com');
} catch {
  rejectedForeign = true;
}
assert('a non-shopify authorization host is rejected', rejectedForeign);

const body = tokenRequestBody({
  code: 'auth-code',
  redirectUri,
  codeVerifier: verifier,
  clientId: 'public-client',
});
assert('token exchange sends the verifier and not a browser customer id', body.get('code_verifier') === verifier && body.get('customer_id') === null);

assert('one delivery fee is accepted', assessDeliveryCharge({ merchandiseTotal: 80, draftShipping: 20, draftTotal: 100 }) === 'ok');
assert('a missing delivery fee is rejected', assessDeliveryCharge({ merchandiseTotal: 80, draftShipping: 0, draftTotal: 80 }) === 'missing');
assert('a stacked shipping amount is rejected', assessDeliveryCharge({ merchandiseTotal: 80, draftShipping: 40, draftTotal: 120 }) === 'stacked');
assert('tax above the single fee is not treated as stacked shipping', assessDeliveryCharge({ merchandiseTotal: 80, draftShipping: 20, draftTotal: 115 }) === 'ok');

assert('anonymous staff access is unauthorized', staffAccessDecision(false, null) === 'unauthorized');
assert('a customer is not staff', staffAccessDecision(true, 'customer') === 'forbidden');
assert('an admin is staff', staffAccessDecision(true, 'admin') === 'allow');
assert('order email uses the same staff decision', orderEmailDecision(true, 'admin') === 'allow');

if (failed > 0) {
  console.error(`${failed} failed`);
  process.exit(1);
}
console.log('phase 4e checks passed');

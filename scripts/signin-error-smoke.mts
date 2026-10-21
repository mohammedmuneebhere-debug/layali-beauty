/**
 * Sign-in failure-path tests. Mocked auth only — no customer credentials.
 *
 * Usage: npm run test:signin
 */
import { AuthConfigError } from '@/lib/auth/password-sign-in';
import {
  AUTH_CONFIG_ERROR_MESSAGE,
  AUTH_GENERIC_ERROR_MESSAGE,
  AUTH_NETWORK_ERROR_MESSAGE,
  AUTH_TIMEOUT_ERROR_MESSAGE,
  completePasswordSignIn,
  mapAuthSignInError,
  messageFromAuthApiError,
  withTimeout,
  type PasswordSignInPort,
} from '@/lib/auth/password-sign-in';

let failed = 0;

function assert(name: string, condition: boolean) {
  if (condition) {
    console.log(`PASS ${name}`);
    return;
  }
  failed += 1;
  console.error(`FAIL ${name}`);
}

function mockAuth(options: {
  signIn?: PasswordSignInPort['signInWithPassword'];
  getSession?: PasswordSignInPort['getSession'];
  profile?: PasswordSignInPort['lookupProfile'];
}): PasswordSignInPort {
  return {
    signInWithPassword:
      options.signIn ??
      (async () => ({
        data: { user: { id: 'user-1' } },
        error: null,
      })),
    getSession: options.getSession ?? (async () => ({ data: { session: {} } })),
    lookupProfile:
      options.profile ??
      (async () => ({ data: { onboarding_completed: true, role: 'user' } })),
  };
}

{
  const result = await completePasswordSignIn({
      auth: mockAuth({
      signIn: async () => ({
        data: { user: null },
        error: { message: 'Invalid login credentials' },
      }),
    }),
    email: 'test@example.com',
    password: 'wrong-password',
    redirectTo: '/shop',
  });
  assert(
    'invalid credentials stay on form with actionable error',
    result.kind === 'error' && result.message === 'Invalid login credentials'
  );
}

{
  const loadFailed = new TypeError('Load failed');
  assert(
    'Safari Load failed maps to network copy',
    mapAuthSignInError(loadFailed) === AUTH_NETWORK_ERROR_MESSAGE
  );
  assert(
    'Failed to fetch maps to network copy',
    mapAuthSignInError(new TypeError('Failed to fetch')) === AUTH_NETWORK_ERROR_MESSAGE
  );
}

assert(
  'missing client config maps to unavailable copy',
  mapAuthSignInError(new AuthConfigError()) === AUTH_CONFIG_ERROR_MESSAGE
);
assert(
  'supabase ssr missing-key throw maps to unavailable copy',
  mapAuthSignInError(
    new Error('@supabase/ssr: Your project\'s URL and API key are required to create a Supabase client!')
  ) === AUTH_CONFIG_ERROR_MESSAGE
);

{
  const started = Date.now();
  let threw = false;
  try {
    await withTimeout(new Promise(() => {}), 40, AUTH_TIMEOUT_ERROR_MESSAGE);
  } catch (err) {
    threw = err instanceof Error && err.message === AUTH_TIMEOUT_ERROR_MESSAGE;
  }
  assert('withTimeout rejects hung promises', threw && Date.now() - started < 1000);
}

{
  let signInCalls = 0;
  const result = await completePasswordSignIn({
    auth: mockAuth({
      signIn: () => {
        signInCalls += 1;
        return new Promise(() => {});
      },
    }),
    email: 'test@example.com',
    password: 'password123',
    redirectTo: '/shop',
    signInTimeoutMs: 40,
  });

  assert('hung sign-in does not retry', signInCalls === 1);
  assert(
    'hung sign-in surfaces timeout',
    result.kind === 'error' && result.message === AUTH_TIMEOUT_ERROR_MESSAGE
  );
}

{
  const result = await completePasswordSignIn({
    auth: mockAuth({
      signIn: async () => {
        throw new TypeError('Load failed');
      },
    }),
    email: 'test@example.com',
    password: 'password123',
    redirectTo: '/shop',
  });
  assert(
    'thrown network error restores as friendly message',
    result.kind === 'error' && result.message === AUTH_NETWORK_ERROR_MESSAGE
  );
}

{
  const result = await completePasswordSignIn({
      auth: mockAuth({
      profile: async () => {
        throw new Error('profiles lookup failed');
      },
    }),
    email: 'test@example.com',
    password: 'password123',
    redirectTo: '/checkout',
  });
  assert(
    'profile throw still navigates',
    result.kind === 'navigate' && result.path === '/checkout'
  );
}

{
  const result = await completePasswordSignIn({
      auth: mockAuth({
      profile: () => new Promise(() => {}),
    }),
    email: 'test@example.com',
    password: 'password123',
    redirectTo: '',
    profileTimeoutMs: 40,
  });
  assert(
    'hung profile lookup falls back to shop',
    result.kind === 'navigate' && result.path === '/shop'
  );
}

{
  const result = await completePasswordSignIn({
      auth: mockAuth({
      profile: async () => ({ data: { role: 'admin', onboarding_completed: true } }),
    }),
    email: 'admin@example.com',
    password: 'password123',
    redirectTo: '/shop',
  });
  assert('admin routes to /admin', result.kind === 'navigate' && result.path === '/admin');
}

{
  const result = await completePasswordSignIn({
      auth: mockAuth({
      profile: async () => ({ data: { role: 'user', onboarding_completed: false } }),
    }),
    email: 'new@example.com',
    password: 'password123',
    redirectTo: '/shop',
  });
  assert('incomplete onboarding routes to /survey', result.kind === 'navigate' && result.path === '/survey');
}

{
  const result = await completePasswordSignIn({
      auth: mockAuth({}),
    email: 'user@example.com',
    password: 'password123',
    redirectTo: 'https://evil.example',
  });
  assert('unsafe redirect is ignored', result.kind === 'navigate' && result.path === '/shop');
}

assert(
  'generic errors stay generic',
  mapAuthSignInError(new Error('boom')) === AUTH_GENERIC_ERROR_MESSAGE
);

assert(
  'Auth API Load failed object maps to network copy',
  messageFromAuthApiError({ message: 'Load failed' }) === AUTH_NETWORK_ERROR_MESSAGE
);
assert(
  'Auth API Failed to fetch object maps to network copy',
  messageFromAuthApiError({ message: 'Failed to fetch' }) === AUTH_NETWORK_ERROR_MESSAGE
);

{
  const result = await completePasswordSignIn({
    auth: mockAuth({
      signIn: async () => ({
        data: { user: null },
        error: { message: 'Failed to fetch' },
      }),
    }),
    email: 'test@example.com',
    password: 'password123',
    redirectTo: '/shop',
  });
  assert(
    'returned fetch failure uses friendly network copy',
    result.kind === 'error' && result.message === AUTH_NETWORK_ERROR_MESSAGE
  );
}

if (failed) {
  console.error(`\n${failed} sign-in smoke test(s) failed`);
  process.exit(1);
}

console.log('\nAll sign-in smoke tests passed');

import { safeAuthRedirect } from '@/lib/auth/navigate-after-auth';

export class AuthConfigError extends Error {
  constructor(message = 'Sign-in is not configured') {
    super(message);
    this.name = 'AuthConfigError';
  }
}

export const AUTH_SIGN_IN_TIMEOUT_MS = 20_000;
export const AUTH_PROFILE_LOOKUP_TIMEOUT_MS = 8_000;

export const AUTH_NETWORK_ERROR_MESSAGE =
  'We could not reach the sign-in service. Check your connection and try again.';
export const AUTH_CONFIG_ERROR_MESSAGE =
  'Sign-in is temporarily unavailable. Please try again later.';
export const AUTH_TIMEOUT_ERROR_MESSAGE =
  'Sign-in is taking too long. Please try again.';
export const AUTH_GENERIC_ERROR_MESSAGE =
  'Something went wrong while signing in. Please try again.';
export const AUTH_PROFILE_TIMEOUT_ERROR = 'profile-lookup-timeout';

type AuthUser = { id: string };

type SignInAuthResult = {
  data: { user: AuthUser | null };
  error: { message: string } | null;
};

type ProfileRow = {
  onboarding_completed?: boolean | null;
  role?: string | null;
};

export type PasswordSignInPort = {
  signInWithPassword: (creds: {
    email: string;
    password: string;
  }) => Promise<SignInAuthResult>;
  getSession: () => Promise<unknown>;
  lookupProfile: (userId: string) => Promise<{ data: ProfileRow | null }>;
};

export type PasswordSignInResult =
  | { kind: 'navigate'; path: string }
  | { kind: 'error'; message: string };

export function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  message: string
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      reject(new Error(message));
    }, ms);
    promise.then(
      (value) => {
        clearTimeout(id);
        resolve(value);
      },
      (err) => {
        clearTimeout(id);
        reject(err);
      }
    );
  });
}

export function authErrorText(err: unknown): string {
  if (!err) return '';
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && 'message' in err) {
    return String((err as { message?: unknown }).message || '');
  }
  return String(err);
}

export function isAuthNetworkError(err: unknown): boolean {
  if (!err || typeof err !== 'object') {
    return /failed to fetch|networkerror|load failed/i.test(String(err || ''));
  }
  const name = 'name' in err ? String((err as { name?: string }).name || '') : '';
  const message = authErrorText(err);
  return (
    name === 'AbortError' ||
    name === 'TimeoutError' ||
    /aborted|timeout|failed to fetch|networkerror|load failed/i.test(message)
  );
}

export function mapAuthSignInError(err: unknown): string {
  if (err instanceof AuthConfigError) {
    return AUTH_CONFIG_ERROR_MESSAGE;
  }
  const message = authErrorText(err);
  if (!message) return AUTH_GENERIC_ERROR_MESSAGE;
  if (message === AUTH_TIMEOUT_ERROR_MESSAGE || /timed out after|timeout/i.test(message)) {
    return AUTH_TIMEOUT_ERROR_MESSAGE;
  }
  if (/@supabase\/ssr|not configured|url and api key are required/i.test(message)) {
    return AUTH_CONFIG_ERROR_MESSAGE;
  }
  if (isAuthNetworkError(err)) {
    return AUTH_NETWORK_ERROR_MESSAGE;
  }
  return AUTH_GENERIC_ERROR_MESSAGE;
}

export function messageFromAuthApiError(error: { message: string }): string {
  const mapped = mapAuthSignInError(error);
  if (mapped !== AUTH_GENERIC_ERROR_MESSAGE) return mapped;
  return error.message || AUTH_GENERIC_ERROR_MESSAGE;
}

function destinationForProfile(
  profile: ProfileRow | null | undefined,
  redirectTo: string
): string {
  if (profile?.role === 'admin') return '/admin';
  if (profile?.onboarding_completed === false) return '/survey';
  return safeAuthRedirect(redirectTo, '/shop');
}

/**
 * Email/password sign-in plus role/onboarding routing.
 * Does not retry auth. Profile lookup failures fall through to a safe redirect
 * because the session already exists.
 */
export async function completePasswordSignIn(args: {
  auth: PasswordSignInPort;
  email: string;
  password: string;
  redirectTo: string;
  signInTimeoutMs?: number;
  profileTimeoutMs?: number;
}): Promise<PasswordSignInResult> {
  const signInTimeoutMs = args.signInTimeoutMs ?? AUTH_SIGN_IN_TIMEOUT_MS;
  const profileTimeoutMs = args.profileTimeoutMs ?? AUTH_PROFILE_LOOKUP_TIMEOUT_MS;

  let userId: string;
  try {
    const signedIn = await withTimeout(
      args.auth.signInWithPassword({
        email: args.email,
        password: args.password,
      }),
      signInTimeoutMs,
      AUTH_TIMEOUT_ERROR_MESSAGE
    );

    if (signedIn.error) {
      return {
        kind: 'error',
        message: messageFromAuthApiError(signedIn.error),
      };
    }

    if (!signedIn.data.user) {
      return { kind: 'error', message: AUTH_GENERIC_ERROR_MESSAGE };
    }

    userId = signedIn.data.user.id;
  } catch (err) {
    return { kind: 'error', message: mapAuthSignInError(err) };
  }

  try {
    await withTimeout(Promise.resolve(args.auth.getSession()), 5_000, AUTH_TIMEOUT_ERROR_MESSAGE);
  } catch {
    // Cookie refresh is best-effort; hard navigation still includes whatever was stored.
  }

  let profile: ProfileRow | null = null;
  try {
    const { data } = await withTimeout(
      args.auth.lookupProfile(userId),
      profileTimeoutMs,
      AUTH_PROFILE_TIMEOUT_ERROR
    );
    profile = data;
  } catch {
    profile = null;
  }

  return { kind: 'navigate', path: destinationForProfile(profile, args.redirectTo) };
}

import { safeAuthRedirect } from '@/lib/auth/navigate-after-auth';

export function continueRedirectPath(input: {
  signedIn: boolean;
  staff: boolean;
  onboardingCompleted: boolean;
  requested: string | null | undefined;
}): string {
  if (!input.signedIn) return '/auth/signin';
  const requested = (input.requested || '').trim();
  if (
    input.staff &&
    (!requested || requested.startsWith('/admin') || requested.startsWith('/auth/admin'))
  ) {
    return '/admin';
  }
  if (!input.onboardingCompleted) return '/survey';
  return safeAuthRedirect(requested, '/shop');
}

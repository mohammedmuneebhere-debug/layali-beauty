/**
 * Client-side `router.push` after sign-in does not always send a full
 * document request, so middleware/RSC can still see the guest session
 * until the user refreshes. A hard navigation includes the new cookies.
 */
export function safeAuthRedirect(path: string | null | undefined, fallback = '/shop'): string {
  const value = (path || '').trim();
  if (
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('://') ||
    value.startsWith('/auth')
  ) {
    return fallback;
  }
  return value;
}

export function navigateAfterAuth(path: string) {
  window.location.assign(safeAuthRedirect(path));
}

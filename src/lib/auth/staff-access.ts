/** Server-side staff check. A customer-controlled metafield must not satisfy this. */
export function staffAccessDecision(
  hasUser: boolean,
  role: string | null | undefined
): 'allow' | 'unauthorized' | 'forbidden' {
  if (!hasUser) return 'unauthorized';
  if (role !== 'admin') return 'forbidden';
  return 'allow';
}

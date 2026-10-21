/** Server allowlist. A Shopify customer session never grants staff by itself. */

export function staffAllowlist(env: NodeJS.ProcessEnv = process.env): string[] {
  return (env.LAYALI_STAFF_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isAllowlistedStaff(
  email: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): boolean {
  const normalized = email?.trim().toLowerCase() || '';
  if (!normalized) return false;
  return staffAllowlist(env).includes(normalized);
}

export function staffEmailDecision(
  email: string | null | undefined,
  env: NodeJS.ProcessEnv = process.env
): 'allow' | 'unauthorized' | 'forbidden' {
  if (!email?.trim()) return 'unauthorized';
  return isAllowlistedStaff(email, env) ? 'allow' : 'forbidden';
}

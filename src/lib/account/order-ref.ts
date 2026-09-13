/** Customer-facing order slug from Shopify order name (`#1002` → `1002`). */
export function toCustomerOrderRef(orderName: string | null | undefined): string {
  return (orderName || '').trim().replace(/^#/, '');
}

export function displayOrderNumber(orderName: string | null | undefined): string {
  const raw = (orderName || '').trim();
  if (!raw) return '';
  return raw.startsWith('#') ? raw : `#${raw}`;
}

function decodeOrderRefInput(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

export function normalizeOrderRef(value: string | null | undefined): string {
  const raw = (value || '').trim();
  if (!raw) return '';
  const decoded = decodeOrderRefInput(raw);
  if (decoded === null) return '';
  return decoded.replace(/^#/, '').toLowerCase();
}

export function isForbiddenOrderRef(ref: string): boolean {
  const value = (ref || '').trim();
  if (!value || value.length > 64) return true;
  const decoded = decodeOrderRefInput(value);
  if (decoded === null) return true;
  if (/gid:\/\//i.test(value) || /gid:\/\//i.test(decoded)) return true;
  if (/^gid$/i.test(value) || /^gid$/i.test(decoded)) return true;
  return false;
}

export function refsMatchOrderName(orderName: string | null | undefined, ref: string): boolean {
  const left = normalizeOrderRef(orderName);
  const right = normalizeOrderRef(ref);
  return Boolean(left && right && left === right);
}

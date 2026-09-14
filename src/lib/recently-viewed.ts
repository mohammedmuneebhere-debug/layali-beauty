const STORAGE_KEY = 'layali-recently-viewed';
const MAX_HANDLES = 8;

function readHandles(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((h): h is string => typeof h === 'string' && h.length > 0).slice(0, MAX_HANDLES);
  } catch {
    return [];
  }
}

export function getRecentlyViewedHandles(): string[] {
  return readHandles();
}

export function rememberViewedProduct(handle: string) {
  if (typeof window === 'undefined') return;
  const trimmed = handle.trim();
  if (!trimmed || trimmed.startsWith('gid://')) return;
  const next = [trimmed, ...readHandles().filter((h) => h !== trimmed)].slice(0, MAX_HANDLES);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

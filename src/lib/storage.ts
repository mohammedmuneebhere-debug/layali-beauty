export const CATALOG_BUCKET = 'catalog';

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_MB = 5;

export function validateImageFile(file: File): string | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return 'Please upload a JPG, PNG, WebP, or GIF image.';
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return `Image must be smaller than ${MAX_SIZE_MB}MB.`;
  }
  return null;
}

export function readImageDimensionsFromFile(
  file: File
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not read image dimensions'));
    };
    img.src = url;
  });
}

export async function uploadCatalogImage(
  file: File,
  folder: 'products' | 'combos' | 'banners'
): Promise<{
  url: string | null;
  error: string | null;
  width?: number;
  height?: number;
}> {
  const validationError = validateImageFile(file);
  if (validationError) return { url: null, error: validationError };

  let width: number | undefined;
  let height: number | undefined;
  try {
    const dims = await readImageDimensionsFromFile(file);
    width = dims.width;
    height = dims.height;
  } catch {
    // optional
  }

  const form = new FormData();
  form.set('file', file);
  form.set('folder', folder);
  const response = await fetch('/api/admin/uploads', { method: 'POST', body: form });
  const json = (await response.json().catch(() => ({}))) as { url?: string; error?: string };
  if (!response.ok || !json.url) {
    return { url: null, error: json.error || 'Upload failed. Please try again.' };
  }
  return { url: json.url, error: null, width, height };
}

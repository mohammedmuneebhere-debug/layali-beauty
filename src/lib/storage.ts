import type { SupabaseClient } from '@supabase/supabase-js';

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

export async function uploadCatalogImage(
  supabase: SupabaseClient,
  file: File,
  folder: 'products' | 'combos'
): Promise<{ url: string | null; error: string | null }> {
  const validationError = validateImageFile(file);
  if (validationError) return { url: null, error: validationError };

  const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const filePath = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage
    .from(CATALOG_BUCKET)
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type,
    });

  if (error) {
    return { url: null, error: error.message };
  }

  const { data } = supabase.storage.from(CATALOG_BUCKET).getPublicUrl(filePath);
  return { url: data.publicUrl, error: null };
}

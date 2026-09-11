import type { SupabaseClient } from '@supabase/supabase-js';

/** Resolve active Layali region id from country + city */
export async function getRegionId(
  supabase: SupabaseClient,
  country: string,
  city: string
): Promise<string | null> {
  if (!country || !city) return null;

  const { data } = await supabase
    .from('regions')
    .select('id')
    .eq('country', country)
    .eq('city', city)
    .eq('is_active', true)
    .single();

  return data?.id ?? null;
}

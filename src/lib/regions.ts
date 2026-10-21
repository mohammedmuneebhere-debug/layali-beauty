import { readCatalogRules } from '@/lib/content/store';

/** Resolve an active Layali region id from country + city. Empty rules mean no city filter. */
export async function getRegionId(country: string, city: string): Promise<string | null> {
  if (!country || !city) return null;
  const rules = await readCatalogRules();
  const match = rules.regions.find(
    (region) =>
      region.is_active &&
      region.country.trim().toLowerCase() === country.trim().toLowerCase() &&
      region.city.trim().toLowerCase() === city.trim().toLowerCase()
  );
  return match?.id ?? null;
}

/**
 * Production reverse-geocoding provider.
 * HERE / Google / SPL remain future options and must not be called from production flows.
 */
export const PRODUCTION_REVERSE_PROVIDER = 'nominatim' as const;

export type ProductionReverseProvider = typeof PRODUCTION_REVERSE_PROVIDER;

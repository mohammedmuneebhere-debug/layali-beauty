/**
 * Production reverse-geocode used by AddressForm / checkout pin updates.
 * Calls server-side Nominatim assist. HERE/Google POCs must not be imported here.
 */
export type ReverseGeocodeResult = {
  address_line: string;
  street: string;
  area: string;
  city: string;
  postalCode: string;
  country: string;
  building: string;
  countryCode: string;
};

export async function reverseGeocode(
  lat: number,
  lng: number,
  language?: string
): Promise<ReverseGeocodeResult> {
  const res = await fetch('/api/geocode/assist', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({
      latitude: lat,
      longitude: lng,
      language: language || 'en',
    }),
  });

  const payload = (await res.json().catch(() => ({}))) as {
    error?: string;
    code?: string;
    result?: {
      formattedAddress?: string | null;
      street?: string | null;
      district?: string | null;
      city?: string | null;
      postalCode?: string | null;
      country?: string | null;
      countryCode?: string | null;
      houseNumber?: string | null;
    };
  };

  if (!res.ok || !payload.result) {
    const err = new Error(payload.error || 'Could not look up address for this location') as Error & {
      code?: string;
    };
    err.code = payload.code;
    throw err;
  }

  const r = payload.result;
  return {
    address_line: (r.formattedAddress || '').trim(),
    street: (r.street || '').trim(),
    area: (r.district || '').trim(),
    city: (r.city || '').trim(),
    postalCode: (r.postalCode || '').trim(),
    country: (r.country || '').trim(),
    building: (r.houseNumber || '').trim(),
    countryCode: (r.countryCode || '').trim(),
  };
}

export const DEFAULT_MAP_CENTER = {
  lat: 24.7136,
  lng: 46.6753,
};

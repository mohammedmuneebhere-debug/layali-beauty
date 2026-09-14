import {
  classifySpecificity,
  emptyNormalized,
  emptyToNull,
  GeocodeError,
  haversineMeters,
  type NormalizedReverseGeocode,
} from './types';

type NominatimAddress = Record<string, string | undefined>;

type NominatimResponse = {
  lat?: string;
  lon?: string;
  display_name?: string;
  addresstype?: string;
  type?: string;
  category?: string;
  address?: NominatimAddress;
};

export function normalizeNominatim(
  data: NominatimResponse,
  language: string | null = null,
  query?: { latitude: number; longitude: number }
): NormalizedReverseGeocode {
  const addr = data.address || {};
  const street = emptyToNull(addr.road || addr.pedestrian || addr.footway || addr.path);
  const district = emptyToNull(
    addr.neighbourhood || addr.suburb || addr.city_district || addr.quarter || addr.residential
  );
  const city = emptyToNull(addr.city || addr.town || addr.village || addr.municipality);

  const lat = data.lat != null ? Number(data.lat) : NaN;
  const lng = data.lon != null ? Number(data.lon) : NaN;

  return {
    ...emptyNormalized('nominatim', language),
    latitude: Number.isFinite(lat) ? lat : null,
    longitude: Number.isFinite(lng) ? lng : null,
    formattedAddress: emptyToNull(data.display_name),
    country: emptyToNull(addr.country),
    countryCode: emptyToNull(addr.country_code)?.toUpperCase() || null,
    city,
    district,
    street,
    houseNumber: emptyToNull(addr.house_number),
    postalCode: emptyToNull(addr.postcode),
    additional: null,
    resultType: emptyToNull(data.addresstype || data.type),
    houseNumberType: null,
    queryScore: null,
    fieldScore: null,
    distanceMeters: query
      ? haversineMeters(query.latitude, query.longitude, Number.isFinite(lat) ? lat : null, Number.isFinite(lng) ? lng : null)
      : null,
    language,
    specificity: classifySpecificity(
      [data.addresstype, data.type, data.category],
      emptyToNull(addr.house_number)
    ),
  };
}

export async function reverseGeocodeNominatimNormalized(
  latitude: number,
  longitude: number,
  language?: string
): Promise<NormalizedReverseGeocode> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('lat', String(latitude));
  url.searchParams.set('lon', String(longitude));
  if (language) url.searchParams.set('accept-language', language);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);

  try {
    const res = await fetch(url, {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'LayaliStore/1.0 (address assist)',
      },
      cache: 'no-store',
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new GeocodeError('Could not look up address for this location', 502, 'provider_error');
    }

    const data = (await res.json()) as NominatimResponse;
    return normalizeNominatim(data, language || null, { latitude, longitude });
  } catch (err) {
    if (err instanceof GeocodeError) throw err;
    if (err instanceof Error && err.name === 'AbortError') {
      throw new GeocodeError('Location lookup timed out', 504, 'timeout');
    }
    throw new GeocodeError('Could not look up this location', 502, 'provider_error');
  } finally {
    clearTimeout(timer);
  }
}

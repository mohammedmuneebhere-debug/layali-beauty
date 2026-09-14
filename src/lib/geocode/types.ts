export type ReverseGeocodeProvider = 'here' | 'nominatim' | 'google';

export type GeocodeSpecificity =
  | 'building'
  | 'premise'
  | 'street'
  | 'route'
  | 'neighborhood'
  | 'district'
  | 'city'
  | 'POI'
  | 'other';

/** Stable Layali reverse-geocode shape. Null means the provider omitted the field. */
export type NormalizedReverseGeocode = {
  provider: ReverseGeocodeProvider;
  latitude: number | null;
  longitude: number | null;
  formattedAddress: string | null;
  country: string | null;
  countryCode: string | null;
  city: string | null;
  district: string | null;
  street: string | null;
  houseNumber: string | null;
  postalCode: string | null;
  additional: string | null;
  resultType: string | null;
  houseNumberType: string | null;
  queryScore: number | null;
  fieldScore: Record<string, number> | null;
  distanceMeters: number | null;
  language: string | null;
  specificity: GeocodeSpecificity | null;
};

export class GeocodeError extends Error {
  status: number;
  code: string;

  constructor(message: string, status: number, code: string) {
    super(message);
    this.name = 'GeocodeError';
    this.status = status;
    this.code = code;
  }
}

export const ALLOWED_GEOCODE_LANG = new Set(['en-US', 'en', 'ar', 'ar-SA']);

export function parseLanguage(input: unknown, fallback = 'en-US'): string {
  const requested = typeof input === 'string' ? input.trim() : fallback;
  return ALLOWED_GEOCODE_LANG.has(requested) ? requested : fallback;
}

export function emptyToNull(value: string | undefined | null): string | null {
  const next = String(value || '').trim();
  return next ? next : null;
}

export function emptyNormalized(
  provider: ReverseGeocodeProvider,
  language: string | null = null
): NormalizedReverseGeocode {
  return {
    provider,
    latitude: null,
    longitude: null,
    formattedAddress: null,
    country: null,
    countryCode: null,
    city: null,
    district: null,
    street: null,
    houseNumber: null,
    postalCode: null,
    additional: null,
    resultType: null,
    houseNumberType: null,
    queryScore: null,
    fieldScore: null,
    distanceMeters: null,
    language,
    specificity: null,
  };
}

export function parseCoordinates(input: unknown): { latitude: number; longitude: number } {
  const body = input && typeof input === 'object' ? (input as Record<string, unknown>) : {};
  const latitude = Number(body.latitude);
  const longitude = Number(body.longitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new GeocodeError('latitude and longitude are required numbers', 400, 'invalid_coordinates');
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new GeocodeError('latitude or longitude is out of range', 400, 'invalid_coordinates');
  }

  return { latitude, longitude };
}

/** Approximate distance in meters. Null if either point is incomplete. */
export function haversineMeters(
  lat1: number | null | undefined,
  lng1: number | null | undefined,
  lat2: number | null | undefined,
  lng2: number | null | undefined
): number | null {
  if (
    lat1 == null ||
    lng1 == null ||
    lat2 == null ||
    lng2 == null ||
    !Number.isFinite(lat1) ||
    !Number.isFinite(lng1) ||
    !Number.isFinite(lat2) ||
    !Number.isFinite(lng2)
  ) {
    return null;
  }
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return Math.round(6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
}

export function classifySpecificity(
  types: Array<string | null | undefined> | null | undefined,
  houseNumber?: string | null
): GeocodeSpecificity {
  const set = new Set((types || []).map((t) => String(t || '').trim()).filter(Boolean));
  if (set.has('street_address') || set.has('house') || set.has('houseNumber') || set.has('subpremise')) {
    return 'building';
  }
  if (set.has('premise') || set.has('building')) return 'premise';
  if (houseNumber) return 'building';
  if (set.has('route') || set.has('road') || set.has('street')) {
    return set.has('route') ? 'route' : 'street';
  }
  if (set.has('neighborhood') || set.has('neighbourhood') || set.has('quarter') || set.has('residential')) {
    return 'neighborhood';
  }
  if (
    set.has('sublocality') ||
    set.has('sublocality_level_1') ||
    set.has('district') ||
    set.has('suburb') ||
    set.has('city_district')
  ) {
    return 'district';
  }
  if (set.has('locality') || set.has('city') || set.has('town') || set.has('administrative_area_level_2')) {
    return 'city';
  }
  if (
    set.has('premise') === false &&
    (set.has('point_of_interest') ||
      set.has('establishment') ||
      set.has('amenity') ||
      set.has('shop') ||
      set.has('tourism') ||
      set.has('place') ||
      set.has('man_made'))
  ) {
    return 'POI';
  }
  return 'other';
}

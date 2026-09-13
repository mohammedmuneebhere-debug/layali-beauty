export type ReverseGeocodeResult = {
  /** Legacy full display name (Nominatim). */
  address_line: string;
  street: string;
  area: string;
  city: string;
  postalCode: string;
  country: string;
};

export async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult> {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
    { headers: { Accept: 'application/json' } }
  );

  if (!res.ok) {
    throw new Error('Could not look up address for this location');
  }

  const data = await res.json();
  const addr = (data.address || {}) as Record<string, string | undefined>;

  const road = (addr.road || addr.pedestrian || addr.footway || addr.path || '').trim();
  const houseNumber = (addr.house_number || '').trim();
  const street = [houseNumber, road].filter(Boolean).join(' ').trim();

  const area = (
    addr.neighbourhood ||
    addr.suburb ||
    addr.city_district ||
    addr.quarter ||
    addr.residential ||
    ''
  ).trim();

  const city = (
    addr.city ||
    addr.town ||
    addr.village ||
    addr.municipality ||
    addr.state_district ||
    ''
  ).trim();

  const postalCode = (addr.postcode || '').trim();
  const country = (addr.country || '').trim();
  const displayName = String(data.display_name || '').trim();

  return {
    address_line: displayName,
    street,
    area,
    city,
    postalCode,
    country,
  };
}

export const DEFAULT_MAP_CENTER = {
  lat: 24.7136,
  lng: 46.6753,
};

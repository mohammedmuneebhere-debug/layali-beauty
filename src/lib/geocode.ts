export async function reverseGeocode(lat: number, lng: number) {
  const res = await fetch(
    `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
    { headers: { Accept: 'application/json' } }
  );

  if (!res.ok) {
    throw new Error('Could not look up address for this location');
  }

  const data = await res.json();
  return {
    address_line: (data.display_name as string) || '',
    city:
      data.address?.city ||
      data.address?.town ||
      data.address?.village ||
      data.address?.state_district ||
      '',
    country: (data.address?.country as string) || '',
  };
}

export const DEFAULT_MAP_CENTER = {
  lat: 24.7136,
  lng: 46.6753,
};

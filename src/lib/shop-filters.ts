/** Known brands for shop filters — matched against product names */
export const KNOWN_BRANDS = [
  'COSRX',
  'Isntree',
  'Torriden',
  'TOCOBO',
  'Anua',
  'Beauty of Joseon',
  'Round Lab',
  'Some By Mi',
  'Klairs',
  'Laneige',
  'Innisfree',
  'Huda Beauty',
  'SHEGLAM',
  "L'Oréal",
  'Loreal',
  'Dior',
  'Medicube',
  'The Ordinary',
  'CeraVe',
] as const;

export function detectBrand(productName: string): string | null {
  const lower = productName.toLowerCase();
  for (const brand of KNOWN_BRANDS) {
    if (lower.includes(brand.toLowerCase())) {
      return brand === 'Loreal' ? "L'Oréal" : brand;
    }
  }
  return null;
}

export function collectBrands(products: { name: string }[]): string[] {
  const set = new Set<string>();
  for (const p of products) {
    const brand = detectBrand(p.name);
    if (brand) set.add(brand);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export const PAGE_SIZE = 12;

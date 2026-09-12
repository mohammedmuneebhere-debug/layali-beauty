/** Discover Shopify locations and resolve India → Riyadh targets (no hardcoded IDs). */
import { shopifyAdminFetch } from '@/lib/shopify/admin';

export type LocationAddress = {
  address1: string | null;
  address2: string | null;
  city: string | null;
  province: string | null;
  provinceCode: string | null;
  country: string | null;
  countryCode: string | null;
  zip: string | null;
};

export type DiscoveredLocation = {
  id: string;
  name: string;
  isActive: boolean;
  fulfillsOnlineOrders: boolean;
  hasActiveInventory: boolean;
  address: LocationAddress | null;
};

const LOCATIONS_QUERY = /* GraphQL */ `
  query InventoryMigrationLocations($cursor: String) {
    locations(first: 50, includeInactive: true, after: $cursor) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        name
        isActive
        fulfillsOnlineOrders
        hasActiveInventory
        address {
          address1
          address2
          city
          province
          provinceCode
          country
          countryCode
          zip
        }
      }
    }
  }
`;

type LocationsPage = {
  locations: {
    pageInfo: { hasNextPage: boolean; endCursor: string | null };
    nodes: DiscoveredLocation[];
  };
};

export async function discoverAllLocations(): Promise<DiscoveredLocation[]> {
  const all: DiscoveredLocation[] = [];
  let cursor: string | null = null;

  for (;;) {
    const result = await shopifyAdminFetch<LocationsPage>(LOCATIONS_QUERY, {
      cursor,
    });
    const page: LocationsPage = result.data;

    all.push(...(page.locations.nodes ?? []));
    if (!page.locations.pageInfo.hasNextPage) break;
    cursor = page.locations.pageInfo.endCursor;
    if (!cursor) break;
  }

  return all;
}

function countryCodeOf(loc: DiscoveredLocation): string {
  return (loc.address?.countryCode || '').trim().toUpperCase();
}

function countryNameOf(loc: DiscoveredLocation): string {
  return (loc.address?.country || '').trim().toLowerCase();
}

function cityOf(loc: DiscoveredLocation): string {
  return (loc.address?.city || '').trim().toLowerCase();
}

function nameOf(loc: DiscoveredLocation): string {
  return (loc.name || '').trim().toLowerCase();
}

/** User-confirmed Riyadh address signals (do not invent locations). */
export const RIYADH_ADDRESS_HINTS = [
  'ibn ayaaz al kinani',
  'ibn ayaaz',
  'al olaya',
  'olaya',
  'riyadh',
] as const;

function addressBlob(loc: DiscoveredLocation): string {
  const a = loc.address;
  return [
    loc.name,
    a?.address1,
    a?.address2,
    a?.city,
    a?.province,
    a?.country,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

/** Score how well a location matches Ibn Ayaaz Al Kinani, Al Olaya, Riyadh. */
export function riyadhAddressMatchScore(loc: DiscoveredLocation): number {
  const blob = addressBlob(loc);
  let score = 0;
  if (blob.includes('ibn ayaaz al kinani') || blob.includes('ibn ayaaz')) score += 40;
  if (blob.includes('al olaya') || blob.includes('olaya')) score += 30;
  if (cityOf(loc).includes('riyadh') || blob.includes('riyadh')) score += 20;
  if (countryCodeOf(loc) === 'SA' || countryNameOf(loc).includes('saudi')) score += 10;
  return score;
}

/** Saudi / Riyadh candidates — country SA, city/name Riyadh, or Al Olaya address hints. */
export function findSaudiRiyadhCandidates(
  locations: DiscoveredLocation[]
): DiscoveredLocation[] {
  return locations.filter((loc) => {
    const code = countryCodeOf(loc);
    const country = countryNameOf(loc);
    const city = cityOf(loc);
    const name = nameOf(loc);
    const blob = addressBlob(loc);

    const isSaudi =
      code === 'SA' ||
      country.includes('saudi') ||
      name.includes('saudi') ||
      name.includes('riyadh') ||
      city.includes('riyadh') ||
      blob.includes('al olaya') ||
      blob.includes('olaya') ||
      blob.includes('ibn ayaaz');

    return isSaudi;
  });
}

/**
 * Prefer location matching Ibn Ayaaz Al Kinani, Al Olaya, Riyadh.
 * Returns null if zero candidates, or multiple equally ambiguous matches.
 */
export function pickRiyadhTarget(
  candidates: DiscoveredLocation[]
): DiscoveredLocation | null {
  if (candidates.length === 0) return null;
  if (candidates.length === 1) return candidates[0]!;

  const scored = candidates
    .map((loc) => ({ loc, score: riyadhAddressMatchScore(loc) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return null;

  const best = scored[0]!;
  // Prefer a clear Al Olaya / Ibn Ayaaz / Riyadh address hit (score >= 20 = at least Riyadh).
  const topTies = scored.filter((x) => x.score === best.score);
  if (topTies.length === 1 && best.score >= 20) return best.loc;

  // Exact street+neighborhood preference among ties
  const olayaIbn = scored.filter(
    (x) =>
      addressBlob(x.loc).includes('olaya') &&
      (addressBlob(x.loc).includes('ibn ayaaz') ||
        cityOf(x.loc).includes('riyadh'))
  );
  if (olayaIbn.length === 1) return olayaIbn[0]!.loc;

  return null;
}

/** India location candidates. */
export function findIndiaCandidates(
  locations: DiscoveredLocation[]
): DiscoveredLocation[] {
  return locations.filter((loc) => {
    const code = countryCodeOf(loc);
    const country = countryNameOf(loc);
    const name = nameOf(loc);
    return (
      code === 'IN' ||
      country === 'india' ||
      country.includes('india') ||
      name.includes('india')
    );
  });
}

export function formatLocationLine(loc: DiscoveredLocation): string {
  const a = loc.address;
  const addrParts = [
    a?.address1,
    a?.address2,
    a?.city,
    a?.province,
    a?.country,
    a?.zip,
  ]
    .filter(Boolean)
    .join(', ');

  return [
    `id=${loc.id}`,
    `name="${loc.name}"`,
    `city=${a?.city ?? '—'}`,
    `province=${a?.province ?? a?.provinceCode ?? '—'}`,
    `country=${a?.country ?? '—'} (${a?.countryCode ?? '—'})`,
    `active=${loc.isActive}`,
    `fulfillsOnlineOrders=${loc.fulfillsOnlineOrders}`,
    `hasActiveInventory=${loc.hasActiveInventory}`,
    `address=${addrParts || '—'}`,
  ].join(' | ');
}

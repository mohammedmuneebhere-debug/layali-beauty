/** Resolve and validate the hardcoded Riyadh location ID. */
import {
  discoverAllLocations,
  formatLocationLine,
  type DiscoveredLocation,
} from '@/lib/migration/inventory-to-riyadh/locations';
import { RIYADH_LOCATION_ID } from './constants';

export async function resolveRiyadhLocation(): Promise<DiscoveredLocation> {
  const locations = await discoverAllLocations();
  const match = locations.find((l) => l.id === RIYADH_LOCATION_ID);

  if (!match) {
    const listing = locations.map((l) => `  - ${formatLocationLine(l)}`).join('\n');
    throw new Error(
      [
        `STOP: Hardcoded Riyadh location not found: ${RIYADH_LOCATION_ID}`,
        'Available locations:',
        listing || '  (none)',
      ].join('\n')
    );
  }

  return match;
}

export { formatLocationLine };

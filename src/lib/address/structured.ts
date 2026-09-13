/**
 * Display/conversion layer for structured delivery addresses.
 * Persists to existing Supabase columns (address_line + city + country)
 * without a schema migration.
 */

export type StructuredAddressFields = {
  building: string;
  apartment: string;
  street: string;
  area: string;
  city: string;
  postalCode: string;
  directions: string;
  country: string;
};

export type ReverseGeocodeStructured = {
  street?: string;
  area?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  /** Full Nominatim display_name — only used as legacy fallback. */
  displayName?: string;
};

export function emptyStructuredAddress(
  overrides?: Partial<StructuredAddressFields>
): StructuredAddressFields {
  return {
    building: '',
    apartment: '',
    street: '',
    area: '',
    city: '',
    postalCode: '',
    directions: '',
    country: '',
    ...overrides,
  };
}

/** Compose a human-readable multi-line address_line for storage / Shopify address1. */
export function composeAddressLine(fields: StructuredAddressFields): string {
  const primary = [
    fields.apartment,
    fields.building,
    fields.street,
    fields.area,
    fields.postalCode,
  ]
    .map((v) => v.trim())
    .filter(Boolean);

  const directions = fields.directions.trim();
  if (directions) {
    return [...primary, '', directions].join('\n');
  }
  return primary.join('\n');
}

/** Compact summary lines for checkout UI (skips empty fields). */
export function formatAddressSummaryLines(fields: StructuredAddressFields): string[] {
  return [
    fields.apartment,
    fields.building,
    fields.street,
    fields.area,
    fields.city,
    fields.postalCode,
    fields.directions,
  ]
    .map((v) => v.trim())
    .filter(Boolean);
}

/**
 * Load DB address into structured fields.
 * Does NOT guess building/street/area from a legacy blob —
 * puts the whole address_line into Street when it cannot be decomposed.
 */
export function structuredFromStoredAddress(input: {
  address_line?: string | null;
  city?: string | null;
  country?: string | null;
}): StructuredAddressFields {
  const raw = String(input.address_line || '').trim();
  const city = String(input.city || '').trim();
  const country = String(input.country || '').trim();

  if (!raw) {
    return emptyStructuredAddress({ city, country });
  }

  // Round-trip format we write: optional labeled lines (see composeLabeled).
  const labeled = tryParseLabeledAddressLine(raw);
  if (labeled) {
    return { ...labeled, city: labeled.city || city, country: labeled.country || country };
  }

  // Legacy / unknown: preserve full text in Street — do not invent parts.
  return emptyStructuredAddress({
    street: raw,
    city,
    country,
  });
}

/**
 * Labeled storage keeps field identity without a migration.
 * Still human-readable for couriers and address cards.
 */
export function composeLabeledAddressLine(fields: StructuredAddressFields): string {
  const rows: string[] = [];
  const push = (key: string, value: string) => {
    const v = value.trim();
    if (v) rows.push(`${key}: ${v}`);
  };
  push('Apt', fields.apartment);
  push('Bldg', fields.building);
  push('St', fields.street);
  push('Area', fields.area);
  push('Zip', fields.postalCode);

  const directions = fields.directions.trim();
  if (directions) {
    if (rows.length) rows.push('');
    rows.push(directions);
  }
  return rows.join('\n');
}

function tryParseLabeledAddressLine(raw: string): StructuredAddressFields | null {
  const lines = raw.split(/\r?\n/);
  const fields = emptyStructuredAddress();
  let sawLabel = false;
  const directionLines: string[] = [];
  let inDirections = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      if (sawLabel) inDirections = true;
      continue;
    }

    const match = /^(Apt|Bldg|St|Area|Zip)\s*:\s*(.+)$/i.exec(trimmed);
    if (match && !inDirections) {
      sawLabel = true;
      const key = match[1].toLowerCase();
      const value = match[2].trim();
      if (key === 'apt') fields.apartment = value;
      else if (key === 'bldg') fields.building = value;
      else if (key === 'st') fields.street = value;
      else if (key === 'area') fields.area = value;
      else if (key === 'zip') fields.postalCode = value;
      continue;
    }

    if (sawLabel) {
      inDirections = true;
      directionLines.push(trimmed);
      continue;
    }

    // Unlabeled content before any label → not our format.
    return null;
  }

  if (!sawLabel) return null;
  fields.directions = directionLines.join('\n');
  return fields;
}

export function isLabeledStructuredAddress(addressLine: string): boolean {
  return tryParseLabeledAddressLine(String(addressLine || '').trim()) != null;
}

/** Prefer labeled compose for round-trip; falls back to clean multi-line. */
export function composeStoredAddressLine(fields: StructuredAddressFields): string {
  return composeLabeledAddressLine(fields);
}

/**
 * Apply reverse-geocode results.
 * By default only fills empty fields so manual edits are preserved.
 */
export function applyGeocodeToStructured(
  current: StructuredAddressFields,
  geo: ReverseGeocodeStructured,
  options?: { onlyEmpty?: boolean }
): StructuredAddressFields {
  const onlyEmpty = options?.onlyEmpty ?? true;
  const take = (currentValue: string, next?: string) => {
    const n = (next || '').trim();
    if (!n) return currentValue;
    if (!onlyEmpty) return n;
    return currentValue.trim() ? currentValue : n;
  };

  return {
    ...current,
    street: take(current.street, geo.street),
    area: take(current.area, geo.area),
    city: take(current.city, geo.city),
    postalCode: take(current.postalCode, geo.postalCode),
    country: take(current.country, geo.country),
  };
}

/** Shopify-oriented parts from stored columns (no architecture change required). */
export function toShopifyAddressParts(input: {
  address_line: string;
  city: string;
}): { address1: string; address2: string | null; zip: string | null } {
  const structured = structuredFromStoredAddress({
    address_line: input.address_line,
    city: input.city,
  });

  const address1Parts = [
    structured.street,
    structured.building,
    structured.apartment,
    structured.area,
  ]
    .map((v) => v.trim())
    .filter(Boolean);

  // Legacy blob lives in street — use whole address_line if structured street empty after parse miss.
  const address1 =
    address1Parts.join(', ') ||
    String(input.address_line || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !/^(Apt|Bldg|St|Area|Zip)\s*:/i.test(l))
      .join(', ') ||
    String(input.address_line || '').trim();

  const address2 = structured.directions.trim() || null;
  const zip = structured.postalCode.trim() || null;

  return { address1, address2, zip };
}

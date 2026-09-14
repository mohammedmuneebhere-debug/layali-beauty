/**
 * Display/conversion layer for structured delivery addresses.
 * Persists to existing Supabase columns (address_line + city + country)
 * without a schema migration.
 *
 * Labeled address_line keys:
 *   Apt, Bldg, Add, St, Area, Zip  + optional directions after a blank line
 */

export type StructuredAddressFields = {
  building: string;
  additional: string;
  apartment: string;
  street: string;
  area: string;
  city: string;
  postalCode: string;
  directions: string;
  country: string;
};

export type StructuredFieldKey = keyof StructuredAddressFields;

export type ReverseGeocodeStructured = {
  street?: string;
  area?: string;
  city?: string;
  postalCode?: string;
  country?: string;
  building?: string;
  /** Full Nominatim display_name — only used as legacy fallback. */
  displayName?: string;
};

export type AddressSummaryLabels = {
  additional?: string;
};

export function emptyStructuredAddress(
  overrides?: Partial<StructuredAddressFields>
): StructuredAddressFields {
  return {
    building: '',
    additional: '',
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

/** Map Eastern/Persian digits to ASCII so Saudi postal checks stay fair. */
export function toAsciiDigits(value: string): string {
  return String(value || '')
    .replace(/[\u0660-\u0669]/g, (ch) => String(ch.charCodeAt(0) - 0x0660))
    .replace(/[\u06f0-\u06f9]/g, (ch) => String(ch.charCodeAt(0) - 0x06f0));
}

export function isSaudiPostalCode(value: string): boolean {
  return /^\d{5}$/.test(toAsciiDigits(value).trim());
}

export function isPresentText(value: string): boolean {
  return String(value || '').trim().length > 0;
}

/** Compose a human-readable multi-line address_line for storage / Shopify address1. */
export function composeAddressLine(fields: StructuredAddressFields): string {
  const line1 = [fields.building, fields.street].map((v) => v.trim()).filter(Boolean).join(' ');
  const primary = [line1, fields.area, fields.postalCode, fields.apartment]
    .map((v) => v.trim())
    .filter(Boolean);

  const directions = fields.directions.trim();
  if (directions) {
    return [...primary, '', directions].join('\n');
  }
  return primary.join('\n');
}

/** Compact summary lines for cards / confirmation (skips empty fields). */
export function formatAddressSummaryLines(
  fields: StructuredAddressFields,
  labels?: AddressSummaryLabels
): string[] {
  const line1 = [fields.building, fields.street].map((v) => v.trim()).filter(Boolean).join(' ');
  const line3 = [fields.city, fields.postalCode].map((v) => v.trim()).filter(Boolean).join(' ');
  const additionalLabel = labels?.additional || 'Additional Number';
  const additional = fields.additional.trim()
    ? `${additionalLabel}: ${fields.additional.trim()}`
    : '';

  return [line1, fields.area, line3, fields.apartment, additional, fields.directions]
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

  const labeled = tryParseLabeledAddressLine(raw);
  if (labeled) {
    return { ...labeled, city: labeled.city || city, country: labeled.country || country };
  }

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
  push('Add', fields.additional);
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

    const match = /^(Apt|Bldg|Add|St|Area|Zip)\s*:\s*(.+)$/i.exec(trimmed);
    if (match && !inDirections) {
      sawLabel = true;
      const key = match[1].toLowerCase();
      const value = match[2].trim();
      if (key === 'apt') fields.apartment = value;
      else if (key === 'bldg') fields.building = value;
      else if (key === 'add') fields.additional = value;
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
 *
 * - lockedKeys: customer-entered fields, never overwritten
 * - onlyEmpty (default true): used for saved addresses so confirmed values stay
 * - onlyEmpty false + lockedKeys: unlocked fields may update when the pin moves
 */
export function applyGeocodeToStructured(
  current: StructuredAddressFields,
  geo: ReverseGeocodeStructured,
  options?: { onlyEmpty?: boolean; lockedKeys?: Iterable<string> }
): StructuredAddressFields {
  const onlyEmpty = options?.onlyEmpty ?? true;
  const locked = new Set(options?.lockedKeys || []);

  const take = (key: StructuredFieldKey, currentValue: string, next?: string) => {
    if (locked.has(key)) return currentValue;
    const n = (next || '').trim();
    if (!n) return currentValue;
    if (onlyEmpty) return currentValue.trim() ? currentValue : n;
    return n;
  };

  return {
    ...current,
    building: take('building', current.building, geo.building),
    street: take('street', current.street, geo.street),
    area: take('area', current.area, geo.area),
    city: take('city', current.city, geo.city),
    postalCode: take('postalCode', current.postalCode, geo.postalCode),
    country: take('country', current.country, geo.country),
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
    structured.building,
    structured.street,
    structured.apartment,
    structured.area,
  ]
    .map((v) => v.trim())
    .filter(Boolean);

  const address1 =
    address1Parts.join(', ') ||
    String(input.address_line || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .filter((l) => !/^(Apt|Bldg|Add|St|Area|Zip)\s*:/i.test(l))
      .join(', ') ||
    String(input.address_line || '').trim();

  const address2Parts = [structured.additional, structured.directions]
    .map((v) => v.trim())
    .filter(Boolean);
  const address2 = address2Parts.length ? address2Parts.join(' · ') : null;
  const zip = structured.postalCode.trim() || null;

  return { address1, address2, zip };
}

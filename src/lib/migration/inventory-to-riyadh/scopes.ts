/** Admin scope verification for inventory migration. Never logs tokens. */
import { shopifyAdminFetch } from '@/lib/shopify/admin';

export const REQUIRED_SCOPES = [
  'write_inventory',
  'read_locations',
  'read_inventory',
] as const;

export type ScopeCheckResult = {
  granted: string[];
  missing: string[];
  ok: boolean;
};

const ACCESS_SCOPES_QUERY = /* GraphQL */ `
  query InventoryMigrationAccessScopes {
    currentAppInstallation {
      accessScopes {
        handle
      }
    }
  }
`;

export async function checkInventoryMigrationScopes(): Promise<ScopeCheckResult> {
  const { data } = await shopifyAdminFetch<{
    currentAppInstallation: {
      accessScopes: { handle: string }[];
    };
  }>(ACCESS_SCOPES_QUERY);

  const granted = (data.currentAppInstallation?.accessScopes ?? []).map((s) =>
    s.handle.replace(/^https:\/\/.*\//, '').replace(/^write_/, 'write_').trim()
  );

  // Shopify returns handles like "write_inventory" or sometimes with prefixes.
  const normalized = granted.map((h) => {
    const bare = h.includes('/') ? h.split('/').pop()! : h;
    return bare.trim();
  });

  const missing = REQUIRED_SCOPES.filter((need) => !normalized.includes(need));

  return {
    granted: normalized.sort(),
    missing: [...missing],
    ok: missing.length === 0,
  };
}

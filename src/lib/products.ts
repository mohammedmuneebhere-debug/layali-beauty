import { readCatalogRules, writeCatalogRules } from '@/lib/content/store';

/** Replace the city availability list for one Shopify product. Empty selection removes the filter rows. */
export async function saveProductRegions(shopifyProductId: string, regionIds: string[]): Promise<void> {
  const rules = await readCatalogRules();
  const rest = rules.productRegions.filter((row) => row.shopifyProductId !== shopifyProductId);
  rules.productRegions = [
    ...rest,
    ...regionIds.map((regionId) => ({
      shopifyProductId,
      regionId,
      isAvailable: true,
    })),
  ];
  await writeCatalogRules(rules);
}

export async function getProductRegionIds(shopifyProductId: string): Promise<string[]> {
  const rules = await readCatalogRules();
  return rules.productRegions
    .filter((row) => row.shopifyProductId === shopifyProductId && row.isAvailable)
    .map((row) => row.regionId);
}

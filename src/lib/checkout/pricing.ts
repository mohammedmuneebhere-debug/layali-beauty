import type { ShopifyCartDiscount, ShopifyCartLine } from '@/lib/shopify/types';

/** Intended Layali COD delivery policy (SAR). Not applied to Shopify draft orders yet. */
export const LAYALI_DELIVERY_FEE = 20;
export const LAYALI_FREE_DELIVERY_MIN = 100;

export function roundMoney(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export type CheckoutLinePricing = {
  id: string;
  name: string;
  quantity: number;
  /** Unit price actually in the Shopify cart (variant price). */
  currentUnit: number;
  /** Real original unit when Shopify compare-at or a line discount exists. */
  originalUnit: number | null;
  lineTotal: number;
  lineSavings: number;
};

/**
 * Original vs current from Shopify cart lines only.
 * Never invents compare-at. Cart allocation discounts are real money.
 */
export function lineCheckoutPricing(line: ShopifyCartLine): CheckoutLinePricing {
  const quantity = Math.max(1, line.quantity);
  const variantUnit = roundMoney(line.price.amount);
  const compareAt = line.compareAtPrice?.amount ?? 0;
  const allocation = roundMoney(line.discountAmount?.amount ?? 0);
  const lineAfterAlloc = roundMoney(variantUnit * quantity - allocation);
  const currentUnit = roundMoney(lineAfterAlloc / quantity);

  let originalUnit: number | null = null;
  if (compareAt > currentUnit + 0.004) {
    originalUnit = roundMoney(compareAt);
  } else if (allocation > 0.004 && variantUnit > currentUnit + 0.004) {
    originalUnit = variantUnit;
  }

  const lineTotal = lineAfterAlloc;
  const lineSavings =
    originalUnit != null ? roundMoney((originalUnit - currentUnit) * quantity) : 0;

  const name =
    line.variantTitle && line.variantTitle !== 'Default Title'
      ? `${line.title} — ${line.variantTitle}`
      : line.title;

  return {
    id: line.id,
    name,
    quantity,
    currentUnit,
    originalUnit: lineSavings > 0.004 ? originalUnit : null,
    lineTotal,
    lineSavings: lineSavings > 0.004 ? lineSavings : 0,
  };
}

export function productSavingsTotal(lines: CheckoutLinePricing[]): number {
  return roundMoney(lines.reduce((sum, line) => sum + line.lineSavings, 0));
}

/**
 * Delivery actually present on the Storefront cart total.
 * COD draft orders currently send line items only (no shippingLine), so this
 * is typically 0 — do not display a different fee than Shopify will charge.
 */
export function chargedDeliveryAmount(subtotal: number, totalAmount: number): number {
  const delta = roundMoney(totalAmount - subtotal);
  return delta > 0.004 ? delta : 0;
}

export function discountRows(discounts: ShopifyCartDiscount[]): { title: string; amount: number }[] {
  return (discounts || [])
    .map((d) => ({ title: d.title, amount: roundMoney(d.amount.amount) }))
    .filter((d) => d.amount > 0.004);
}

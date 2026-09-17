import { DELIVERY_FEE } from '@/lib/constants';
import type { ShopifyCartDiscount, ShopifyCartLine } from '@/lib/shopify/types';

/** Fixed COD delivery (SAR). Same value charged on Shopify draft orders via shippingLine. */
export const LAYALI_DELIVERY_FEE = DELIVERY_FEE;

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

/** Fixed delivery shown on checkout. Storefront cart totals never include this. */
export function checkoutDeliveryAmount(): number {
  return LAYALI_DELIVERY_FEE;
}

/**
 * Payable COD total: Shopify merchandise/cart total + fixed delivery.
 * Cart.cost.totalAmount is merchandise (and discounts) only — not shipping.
 */
export function checkoutPayableTotal(merchandiseTotal: number): number {
  return roundMoney((Number(merchandiseTotal) || 0) + LAYALI_DELIVERY_FEE);
}

export function discountRows(discounts: ShopifyCartDiscount[]): { title: string; amount: number }[] {
  return (discounts || [])
    .map((d) => ({ title: d.title, amount: roundMoney(d.amount.amount) }))
    .filter((d) => d.amount > 0.004);
}

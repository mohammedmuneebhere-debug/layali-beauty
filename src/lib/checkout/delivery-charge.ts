import { LAYALI_DELIVERY_FEE, roundMoney } from '@/lib/checkout/pricing';

export type DeliveryChargeAssessment = 'ok' | 'missing' | 'stacked';

/**
 * The storefront charges Layali's delivery fee once.
 * A Shopify shipping amount above that fee means a second rate was applied.
 * Tax can raise the draft total without raising the shipping line, so the
 * total alone is not treated as a double charge.
 */
export function assessDeliveryCharge(params: {
  merchandiseTotal: number;
  draftShipping: number;
  draftTotal: number;
  fee?: number;
}): DeliveryChargeAssessment {
  const fee = params.fee ?? LAYALI_DELIVERY_FEE;
  const expected = roundMoney((Number(params.merchandiseTotal) || 0) + fee);
  if (params.draftShipping > fee + 0.004) return 'stacked';
  const shippingMissing = params.draftShipping < fee - 0.004;
  const totalShort = params.draftTotal + 0.004 < expected;
  if (shippingMissing && totalShort) return 'missing';
  return 'ok';
}

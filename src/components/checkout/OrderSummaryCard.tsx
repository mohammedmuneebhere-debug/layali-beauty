'use client';

import type { ShopifyCartDiscount, ShopifyCartLine } from '@/lib/shopify/types';
import {
  chargedDeliveryAmount,
  discountRows,
  lineCheckoutPricing,
  productSavingsTotal,
} from '@/lib/checkout/pricing';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n/LanguageProvider';
import { cn } from '@/lib/utils';

type OrderSummaryCardProps = {
  lines: ShopifyCartLine[];
  subtotal: number;
  totalAmount: number;
  discounts: ShopifyCartDiscount[];
  currencyCode: string;
};

export function OrderSummaryCard({
  lines,
  subtotal,
  totalAmount,
  discounts,
  currencyCode,
}: OrderSummaryCardProps) {
  const { t } = useLanguage();
  const priced = lines.map(lineCheckoutPricing);
  const savings = productSavingsTotal(priced);
  const delivery = chargedDeliveryAmount(subtotal, totalAmount);
  const displayTotal = totalAmount || subtotal;
  const promoRows = discountRows(discounts);

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {priced.map((line) => (
          <div key={line.id} className="flex justify-between gap-3 text-sm">
            <div className="min-w-0">
              <p className="text-white/80 leading-snug">
                {line.name} ×{line.quantity}
              </p>
              {line.originalUnit != null ? (
                <p className="mt-1 text-xs text-white/45">
                  <span className="line-through me-2">
                    {t.checkout.originalPrice} {formatPrice(line.originalUnit * line.quantity, currencyCode)}
                  </span>
                  <span className="text-white/80">
                    {t.checkout.nowPrice} {formatPrice(line.lineTotal, currencyCode)}
                  </span>
                </p>
              ) : null}
            </div>
            <span className="shrink-0 font-medium text-white">
              {formatPrice(line.lineTotal, currencyCode)}
            </span>
          </div>
        ))}
      </div>

      <div className="border-t border-layali-pink/20 pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-white/60">{t.cart.subtotal}</span>
          <span className="text-white">{formatPrice(subtotal, currencyCode)}</span>
        </div>
        {promoRows.map((d) => (
          <div key={d.title} className="flex justify-between text-sm">
            <span className="text-white/60">{d.title}</span>
            <span className="text-emerald-300/90">−{formatPrice(d.amount, currencyCode)}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm">
          <span className="text-white/60">{t.checkout.delivery}</span>
          <span className="text-white">{formatPrice(delivery, currencyCode)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-white/60">{t.checkout.payment}</span>
          <span className="text-white">{t.checkout.cod}</span>
        </div>
        <div className="flex justify-between pt-2">
          <span className="font-bold text-white">{t.checkout.total}</span>
          <span className="font-bold text-xl text-white">
            {formatPrice(displayTotal, currencyCode)}
          </span>
        </div>
      </div>

      {savings > 0.004 ? (
        <div
          className={cn(
            'rounded-xl border border-layali-pink/25 bg-layali-pink-glow/10 px-4 py-3',
            'text-sm text-white'
          )}
        >
          <p className="font-medium tracking-wide">
            {t.checkout.youreSaving.replace('{amount}', formatPrice(savings, currencyCode))}
          </p>
          <p className="text-xs text-white/55 mt-1">
            {t.checkout.productSavings}: {formatPrice(savings, currencyCode)}
          </p>
        </div>
      ) : null}
    </div>
  );
}

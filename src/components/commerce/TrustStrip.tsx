import { Truck, ShieldCheck, Sparkles, Headphones } from 'lucide-react';
import { cn } from '@/lib/utils';

const ITEMS = [
  { icon: Truck, key: 'cod' as const },
  { icon: ShieldCheck, key: 'secure' as const },
  { icon: Sparkles, key: 'authentic' as const },
  { icon: Headphones, key: 'support' as const },
];

export function TrustStrip({
  labels,
  className,
}: {
  labels: {
    cod: string;
    secure: string;
    authentic: string;
    support: string;
  };
  className?: string;
}) {
  return (
    <ul
      className={cn(
        'grid grid-cols-2 gap-3 lg:grid-cols-4',
        className
      )}
    >
      {ITEMS.map(({ icon: Icon, key }) => (
        <li
          key={key}
          className="flex items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-layali-gold/25 text-layali-gold-light">
            <Icon className="h-4 w-4" />
          </span>
          <span className="text-sm text-white/75">{labels[key]}</span>
        </li>
      ))}
    </ul>
  );
}

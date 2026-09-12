import { cn } from '@/lib/utils';

interface CardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
}

export function Card({ children, className, hover = false }: CardProps) {
  return (
    <div
      className={cn(
        'bg-layali-surface/80 rounded-2xl border border-white/8 overflow-hidden',
        hover && 'card-hover cursor-pointer',
        className
      )}
    >
      {children}
    </div>
  );
}

export function CardImage({
  src,
  alt,
  className,
  priority = false,
  sizes = '(max-width: 768px) 50vw, (max-width: 1024px) 33vw, 25vw',
}: {
  src?: string | null;
  alt: string;
  className?: string;
  priority?: boolean;
  /** Hint for responsive image selection when CDN serves multiple widths. */
  sizes?: string;
}) {
  return (
    <div className={cn('relative aspect-[4/5] bg-layali-elevated overflow-hidden group', className)}>
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          sizes={sizes}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center">
          <span className="text-3xl text-layali-pink/50">✦</span>
        </div>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-layali-void/50 via-transparent to-transparent opacity-60 pointer-events-none" />
    </div>
  );
}

export function CardContent({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('p-4', className)}>{children}</div>;
}

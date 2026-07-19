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
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div className={cn('relative aspect-[4/5] bg-layali-elevated overflow-hidden group', className)}>
      {src ? (
        <img
          src={src}
          alt={alt}
          className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
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

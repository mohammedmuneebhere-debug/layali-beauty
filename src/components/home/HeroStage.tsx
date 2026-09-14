'use client';

const HERO_VISUAL = '/brand/hero-haircare.jpg';

const IMAGE_MASK = [
  'linear-gradient(to right, transparent 0%, #000 12%, #000 90%, transparent 100%)',
  'linear-gradient(to bottom, transparent 0%, #000 10%, #000 90%, transparent 100%)',
].join(', ');

const EDGE_BLEND =
  'radial-gradient(ellipse 82% 84% at 42% 58%, transparent 48%, rgba(8,4,8,0.22) 76%, rgba(0,0,0,0.72) 100%), linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, transparent 14%)';

export function HeroStage() {
  return (
    <div className="relative mx-auto aspect-square w-full min-w-0 max-w-lg" aria-hidden>
      <div
        className="absolute inset-0"
        style={{
          WebkitMaskImage: IMAGE_MASK,
          maskImage: IMAGE_MASK,
          WebkitMaskComposite: 'source-in',
          maskComposite: 'intersect',
          WebkitMaskRepeat: 'no-repeat',
          maskRepeat: 'no-repeat',
          WebkitMaskSize: '100% 100%',
          maskSize: '100% 100%',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={HERO_VISUAL}
          alt=""
          className="h-full w-full max-w-full select-none object-cover object-center"
          draggable={false}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: EDGE_BLEND }}
        />
      </div>
    </div>
  );
}

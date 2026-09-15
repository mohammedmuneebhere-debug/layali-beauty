'use client';

const HERO_VISUAL = '/brand/hero-makeup.jpg';

const IMAGE_MASK = [
  'linear-gradient(to right, transparent 0%, #000 32%, #000 88%, transparent 100%)',
  'linear-gradient(to bottom, transparent 0%, #000 18%, #000 86%, transparent 100%)',
].join(', ');

const EDGE_BLEND =
  'linear-gradient(90deg, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.35) 18%, transparent 36%), linear-gradient(180deg, rgba(0,0,0,0.45) 0%, transparent 18%), linear-gradient(0deg, rgba(0,0,0,0.5) 0%, transparent 16%), linear-gradient(270deg, rgba(0,0,0,0.38) 0%, transparent 14%), radial-gradient(ellipse 58% 64% at 54% 42%, transparent 46%, rgba(0,0,0,0.2) 78%, rgba(0,0,0,0.72) 100%)';

export function HeroStage() {
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-[min(52vh,420px)] overflow-hidden lg:inset-x-auto lg:start-auto lg:end-0 lg:top-[8%] lg:bottom-0 lg:h-auto lg:w-[min(68vw,62%)] lg:overflow-hidden"
      aria-hidden
    >
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
          className="h-full w-full max-w-none select-none object-cover object-[18%_10%] lg:scale-[0.96] lg:object-[22%_16%] lg:origin-[40%_28%]"
          draggable={false}
        />
        <div
          className="pointer-events-none absolute inset-0"
          style={{ background: EDGE_BLEND }}
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black via-black/55 to-transparent lg:hidden" />
      </div>
    </div>
  );
}

'use client';

import { usePathname } from 'next/navigation';

const HIDDEN_PREFIXES = ['/admin', '/auth/admin'];

const BG0 = '/backgrounds/bg0-stage-still.png';
const BG1 = '/backgrounds/bg1-user-stage.jpg';
const STAGE_STILLS = { bg0: BG0, bg1: BG1 } as const;
/** Flip ACTIVE_STAGE to STAGE_STILLS.bg0 to restore the previous live still. */
const ACTIVE_STAGE = STAGE_STILLS.bg1;

/** Same values as `.layali-stage-*` in globals.css — inline so a stale CSS cache cannot restore the old punch-out veil. */
const PHOTO_MASK =
  'radial-gradient(ellipse 74% 68% at 50% 36%, rgba(0, 0, 0, 0.38) 0%, rgba(0, 0, 0, 0.5) 28%, rgba(0, 0, 0, 0.82) 58%, #000 78%)';

const WASH_BG = [
  'radial-gradient(ellipse 78% 58% at 12% 16%, rgba(212, 46, 124, 0.2), transparent 58%)',
  'radial-gradient(ellipse 52% 48% at 92% 76%, rgba(201, 168, 124, 0.12), transparent 54%)',
  'radial-gradient(ellipse 92% 70% at 50% 108%, rgba(26, 8, 14, 0.9), #0a0206 64%)',
  '#120408',
].join(', ');

const VEIL_BG = [
  'radial-gradient(ellipse 72% 62% at 50% 38%, rgba(8, 1, 4, 0.42) 0%, rgba(8, 1, 4, 0.08) 46%, transparent 72%)',
  'linear-gradient(180deg, rgba(10, 2, 6, 0.28) 0%, rgba(8, 1, 4, 0.06) 42%, rgba(8, 1, 4, 0.78) 100%)',
].join(', ');

/** Same token as `--stage-content-wash` — one veil over BG1, never stacked on sections. */
const CONTENT_WASH = 'rgba(10, 2, 6, 0.34)';

/**
 * One still luxury stage — no rotating plates, no vertical neon bars.
 * The photo lives at the edges; the center stays a dark wash so UI is not
 * crossed by drapery lines or a podium.
 */
export function StageBackdrop() {
  const pathname = usePathname();
  if (HIDDEN_PREFIXES.some((p) => pathname.startsWith(p))) return null;

  return (
    <div className="layali-stage pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden>
      <div className="layali-stage-wash absolute inset-0" style={{ background: WASH_BG }} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ACTIVE_STAGE}
        alt=""
        decoding="async"
        fetchPriority="high"
        data-stage="bg1"
        className="layali-stage-photo absolute inset-0 h-full w-full object-cover object-[50%_42%] max-lg:object-[50%_36%]"
        style={{
          opacity: 0.78,
          transform: 'scale(1.02)',
          filter: 'saturate(0.96) brightness(0.82)',
          WebkitMaskImage: PHOTO_MASK,
          maskImage: PHOTO_MASK,
        }}
      />
      <div className="layali-stage-veil absolute inset-0" style={{ background: VEIL_BG }} />
      <div className="stage-content-wash pointer-events-none absolute inset-0" style={{ backgroundColor: CONTENT_WASH }} />
    </div>
  );
}

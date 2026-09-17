'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export type CinematicSource = {
  src: string;
  type: string;
};

type CinematicVideoProps = {
  sources: CinematicSource[];
  poster?: string;
  className?: string;
  preload?: 'none' | 'metadata' | 'auto';
  width?: number;
  height?: number;
};

type Syncer = {
  video: HTMLVideoElement;
  index: number;
  play: () => void;
  pause: () => void;
};

/** Cap simultaneous decodes — category grid + films can otherwise play 7 at once. */
const MAX_PLAYING = 2;
const playing = new Set<HTMLVideoElement>();
const syncers = new Set<Syncer>();

let hooked = false;
let ticking = false;
let nextIndex = 0;

/**
 * Visible clips near the viewport center outrank clips that merely
 * intersect. Otherwise the first DOM videos keep both decode slots
 * for as long as 1px remains on screen.
 */
function visibilityScore(video: HTMLVideoElement) {
  const r = video.getBoundingClientRect();
  const vh = window.innerHeight;
  if (r.width < 2 || r.height < 2) return 0;

  const inset = 8;
  const visibleH = Math.min(r.bottom, vh - inset) - Math.max(r.top, inset);
  const visibleW = Math.min(r.right, window.innerWidth) - Math.max(r.left, 0);
  if (visibleH <= 0 || visibleW <= 0) return 0;

  const ratio = Math.min(1, (visibleH * visibleW) / (r.width * r.height));
  const cy = r.top + r.height / 2;
  const ny = Math.abs(cy - vh / 2) / (vh / 2 || 1);
  // Quantize so a 6-column row ties on vertical score and falls through
  // to DOM order (Makeup, Skincare) instead of locking a random pair.
  return Math.round((ratio * 3 - ny) * 20) / 20;
}

function pump() {
  ticking = false;
  const hidden = document.visibilityState === 'hidden';
  const ranked = [...syncers].map((entry) => ({
    entry,
    score: hidden ? 0 : visibilityScore(entry.video),
  }));
  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.entry.index - b.entry.index;
  });

  const next = new Set<HTMLVideoElement>();
  for (const { entry, score } of ranked) {
    if (score > 0 && next.size < MAX_PLAYING) next.add(entry.video);
  }

  for (const { entry } of ranked) {
    if (!next.has(entry.video)) entry.pause();
  }

  playing.clear();
  for (const { entry } of ranked) {
    if (!next.has(entry.video)) continue;
    playing.add(entry.video);
    entry.play();
  }
}

function requestPump() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(pump);
}

function ensureScrollHook() {
  if (hooked || typeof window === 'undefined') return;
  hooked = true;
  window.addEventListener('scroll', requestPump, { passive: true, capture: true });
  window.addEventListener('resize', requestPump, { passive: true });
}

/**
 * Decorative cinematic loop. Native autoPlay is omitted so off-screen clips
 * do not start decoding. A shared passive scroll pump plays in-view clips
 * under a decode cap of two.
 */
export function CinematicVideo({
  sources,
  poster,
  className,
  preload = 'none',
  width,
  height,
}: CinematicVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const primary = sources[0];

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !primary?.src) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');
    video.pause();

    let cancelled = false;
    const index = nextIndex++;

    const entry: Syncer = {
      video,
      index,
      play: () => {
        if (cancelled) return;
        video.muted = true;
        const attempt = video.play();
        if (attempt) attempt.catch(() => {});
      },
      pause: () => {
        video.pause();
      },
    };

    ensureScrollHook();
    syncers.add(entry);
    requestPump();
    requestAnimationFrame(requestPump);
    video.addEventListener('canplay', requestPump);
    document.addEventListener('visibilitychange', requestPump);

    return () => {
      cancelled = true;
      syncers.delete(entry);
      playing.delete(video);
      video.pause();
      video.removeEventListener('canplay', requestPump);
      document.removeEventListener('visibilitychange', requestPump);
      requestPump();
    };
  }, [primary?.src]);

  if (!primary?.src) return null;

  return (
    <video
      ref={videoRef}
      className={cn(
        'pointer-events-none h-full w-full select-none object-cover',
        className
      )}
      src={primary.src}
      poster={poster}
      muted
      loop
      playsInline
      preload={preload}
      width={width}
      height={height}
      disablePictureInPicture
      disableRemotePlayback
      aria-hidden
      tabIndex={-1}
    />
  );
}

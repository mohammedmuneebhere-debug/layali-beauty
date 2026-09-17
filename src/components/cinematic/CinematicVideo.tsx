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

/** Cap simultaneous decodes — category grid + films can otherwise play 7 at once. */
const MAX_PLAYING = 2;
const playing = new Set<HTMLVideoElement>();
const pending = new Set<() => void>();
const syncers = new Set<() => void>();

let hooked = false;
let ticking = false;

function pump() {
  ticking = false;
  for (const sync of syncers) sync();
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

function acquire(video: HTMLVideoElement): boolean {
  if (playing.has(video)) return true;
  if (playing.size >= MAX_PLAYING) return false;
  playing.add(video);
  return true;
}

function release(video: HTMLVideoElement) {
  playing.delete(video);
  if (pending.size === 0) return;
  const retry = [...pending];
  pending.clear();
  for (const fn of retry) fn();
}

function isOnscreen(video: HTMLVideoElement) {
  const r = video.getBoundingClientRect();
  return (
    r.width >= 2 &&
    r.height >= 2 &&
    r.bottom > 8 &&
    r.top < window.innerHeight - 8
  );
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
    let inView = false;

    const stop = () => {
      video.pause();
      release(video);
    };

    const tryPlay = () => {
      pending.delete(tryPlay);
      if (cancelled || !inView || document.visibilityState === 'hidden') return;
      if (!acquire(video)) {
        video.pause();
        pending.add(tryPlay);
        return;
      }
      video.muted = true;
      const attempt = video.play();
      if (attempt) attempt.catch(() => {});
    };

    const sync = () => {
      if (cancelled) return;
      inView = isOnscreen(video);
      if (inView) tryPlay();
      else stop();
    };

    ensureScrollHook();
    syncers.add(sync);
    sync();
    requestPump();
    video.addEventListener('canplay', tryPlay);
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') stop();
      else requestPump();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      pending.delete(tryPlay);
      syncers.delete(sync);
      stop();
      video.removeEventListener('canplay', tryPlay);
      document.removeEventListener('visibilitychange', onVisibility);
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

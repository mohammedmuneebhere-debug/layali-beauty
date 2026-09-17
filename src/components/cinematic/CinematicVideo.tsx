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
  /** Category tiles play on their own. Other films stay on the 2-slot scheduler. */
  playbackMode?: 'scheduled' | 'independent';
};

type Syncer = {
  video: HTMLVideoElement;
  index: number;
  play: () => void;
  pause: () => void;
};

type Ranked = {
  entry: Syncer;
  score: number;
};

/** Cap simultaneous decodes — category grid + films can otherwise play 7 at once. */
const MAX_PLAYING = 2;
const ROTATE_MS = 4000;
const playing = new Set<HTMLVideoElement>();
const syncers = new Set<Syncer>();

let hooked = false;
let ticking = false;
let nextIndex = 0;
let rotateTimer: number | null = null;
let rotateEpoch = 0;

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
  // Quantize so a full-width category row shares one score instead of
  // flickering between near-equal pixels.
  return Math.round((ratio * 3 - ny) * 20) / 20;
}

/**
 * Fill up to MAX_PLAYING from the highest-scoring group. When more clips
 * share that score than there are slots (desktop 6-column row), rotate
 * pairs on a timer. Lower-scoring rows wait until they outrank the rest.
 */
function pickNext(ranked: Ranked[]) {
  const next = new Set<HTMLVideoElement>();
  let needsRotate = false;
  let i = 0;
  while (i < ranked.length && next.size < MAX_PLAYING) {
    const score = ranked[i].score;
    if (score <= 0) break;
    let j = i + 1;
    while (j < ranked.length && ranked[j].score === score) j += 1;
    const group = ranked.slice(i, j);
    const remaining = MAX_PLAYING - next.size;
    if (group.length <= remaining) {
      for (const item of group) next.add(item.entry.video);
    } else {
      needsRotate = true;
      if (rotateEpoch === 0) rotateEpoch = Date.now();
      const tick = Math.floor((Date.now() - rotateEpoch) / ROTATE_MS);
      const offset = (tick * remaining) % group.length;
      for (let k = 0; k < remaining; k += 1) {
        next.add(group[(offset + k) % group.length].entry.video);
      }
    }
    i = j;
  }
  return { next, needsRotate };
}

function requestPump() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(pump);
}

function syncRotateTimer(needsRotate: boolean) {
  if (needsRotate) {
    if (rotateTimer == null) {
      rotateTimer = window.setInterval(requestPump, ROTATE_MS);
    }
    return;
  }
  rotateEpoch = 0;
  if (rotateTimer != null) {
    window.clearInterval(rotateTimer);
    rotateTimer = null;
  }
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

  const { next, needsRotate } = pickNext(ranked);
  syncRotateTimer(needsRotate);

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

function ensureScrollHook() {
  if (hooked || typeof window === 'undefined') return;
  hooked = true;
  window.addEventListener('scroll', requestPump, { passive: true, capture: true });
  window.addEventListener('resize', requestPump, { passive: true });
}

/**
 * Decorative cinematic loop. Scheduled clips omit native autoPlay so
 * off-screen films do not start decoding. Independent clips (category
 * tiles) play on their own and do not compete for the two-slot cap.
 */
export function CinematicVideo({
  sources,
  poster,
  className,
  preload,
  width,
  height,
  playbackMode = 'scheduled',
}: CinematicVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const primary = sources[0];
  const resolvedPreload = preload ?? (playbackMode === 'independent' ? 'auto' : 'none');

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !primary?.src) return;

    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.loop = true;
    video.setAttribute('playsinline', '');
    video.setAttribute('webkit-playsinline', '');

    let cancelled = false;

    const tryPlay = () => {
      if (cancelled) return;
      video.muted = true;
      const attempt = video.play();
      if (attempt) attempt.catch(() => {});
    };

    if (playbackMode === 'independent') {
      const onVisibility = () => {
        if (document.visibilityState === 'hidden') video.pause();
        else tryPlay();
      };
      tryPlay();
      video.addEventListener('canplay', tryPlay);
      video.addEventListener('loadeddata', tryPlay);
      document.addEventListener('visibilitychange', onVisibility);
      return () => {
        cancelled = true;
        video.removeEventListener('canplay', tryPlay);
        video.removeEventListener('loadeddata', tryPlay);
        document.removeEventListener('visibilitychange', onVisibility);
        video.pause();
      };
    }

    video.pause();
    const index = nextIndex++;

    const entry: Syncer = {
      video,
      index,
      play: tryPlay,
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
  }, [playbackMode, primary?.src]);

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
      autoPlay={playbackMode === 'independent'}
      preload={resolvedPreload}
      width={width}
      height={height}
      disablePictureInPicture
      disableRemotePlayback
      aria-hidden
      tabIndex={-1}
    />
  );
}

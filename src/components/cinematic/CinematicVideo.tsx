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

/**
 * Decorative cinematic loop. No controls.
 * These clips are the media, not UI chrome — they play even when
 * prefers-reduced-motion is on (Windows animation settings otherwise
 * replace every film with a frozen poster).
 */
export function CinematicVideo({
  sources,
  poster,
  className,
  preload = 'metadata',
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

    let cancelled = false;
    let inView = false;

    const tryPlay = () => {
      if (cancelled || !inView || document.visibilityState === 'hidden') return;
      video.muted = true;
      const attempt = video.play();
      if (attempt) attempt.catch(() => {});
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        if (cancelled) return;
        const r = entry.boundingClientRect;
        // A 0×0 first tick is layout, not off-screen — don't play or pause yet.
        if (r.width < 2 || r.height < 2) {
          return;
        }
        inView = entry.isIntersecting || entry.intersectionRatio > 0;
        if (inView) tryPlay();
        else video.pause();
      },
      { threshold: 0, rootMargin: '120px 0px' }
    );

    io.observe(video);
    video.addEventListener('canplay', tryPlay);
    video.addEventListener('loadeddata', tryPlay);
    document.addEventListener('visibilitychange', tryPlay);

    let attempts = 0;
    const poll = window.setInterval(() => {
      if (cancelled || (inView && !video.paused)) {
        window.clearInterval(poll);
        return;
      }
      if (inView) tryPlay();
      if (++attempts > 40) window.clearInterval(poll);
    }, 200);

    return () => {
      cancelled = true;
      window.clearInterval(poll);
      io.disconnect();
      video.removeEventListener('canplay', tryPlay);
      video.removeEventListener('loadeddata', tryPlay);
      document.removeEventListener('visibilitychange', tryPlay);
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
      autoPlay
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

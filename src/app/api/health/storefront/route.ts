import { NextResponse } from 'next/server';
import { SITE_URL } from '@/lib/constants';

const MARKERS = ['Layali', 'Beauty', 'Shop'];
const PASSWORD_MARKERS = ['Opening soon', 'password', 'store is password'];

async function fetchHome(attempt: number) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(SITE_URL, {
      redirect: 'follow',
      cache: 'no-store',
      signal: controller.signal,
      headers: { 'User-Agent': 'LayaliStorefrontHealth/1.0' },
    });
    const html = await res.text();
    return { status: res.status, html, attempt };
  } finally {
    clearTimeout(timer);
  }
}

function looksLikePasswordPage(html: string) {
  const lower = html.toLowerCase();
  return PASSWORD_MARKERS.some((marker) => lower.includes(marker.toLowerCase()));
}

function hasLayaliMarkers(html: string) {
  return MARKERS.filter((marker) => html.includes(marker)).length >= 2;
}

/**
 * Resilient storefront health check.
 * Transient Shopify password/opening-soon responses are retried before failing.
 */
export async function GET() {
  const attempts: { status: number; passwordLike: boolean; markers: boolean }[] = [];

  for (let i = 1; i <= 3; i++) {
    try {
      const result = await fetchHome(i);
      const passwordLike = looksLikePasswordPage(result.html);
      const markers = hasLayaliMarkers(result.html);
      attempts.push({ status: result.status, passwordLike, markers });

      if (result.status >= 200 && result.status < 400 && markers && !passwordLike) {
        return NextResponse.json({
          ok: true,
          attempts,
          message: 'Storefront healthy',
        });
      }

      if (i < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * i));
      }
    } catch {
      attempts.push({ status: 0, passwordLike: false, markers: false });
      if (i < 3) {
        await new Promise((resolve) => setTimeout(resolve, 1200 * i));
      }
    }
  }

  const persistent = attempts.every((a) => a.status === 0 || a.passwordLike || !a.markers);
  return NextResponse.json(
    {
      ok: false,
      critical: persistent,
      attempts,
      message: persistent
        ? 'Storefront checks failed after retries'
        : 'Transient storefront anomaly; not escalated',
    },
    { status: persistent ? 503 : 200 }
  );
}

/**
 * Resilient storefront monitor.
 * Retries on Shopify password / opening-soon pages before treating as outage.
 *
 * Usage: node scripts/monitor-storefront.mjs
 * Env: SITE_URL (defaults to https://www.layalibeautystore.com)
 */
const SITE_URL = process.env.SITE_URL || 'https://www.layalibeautystore.com';
const MARKERS = ['Layali', 'Beauty', 'Shop'];
const PASSWORD_MARKERS = ['Opening soon', 'store is password', 'Enter store using password'];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkOnce() {
  const res = await fetch(SITE_URL, {
    redirect: 'follow',
    cache: 'no-store',
    headers: { 'User-Agent': 'LayaliStorefrontMonitor/1.0' },
  });
  const html = await res.text();
  const passwordLike = PASSWORD_MARKERS.some((marker) =>
    html.toLowerCase().includes(marker.toLowerCase())
  );
  const markerHits = MARKERS.filter((marker) => html.includes(marker)).length;
  return {
    status: res.status,
    passwordLike,
    markers: markerHits >= 2,
    title: (html.match(/<title>([^<]+)<\/title>/i) || [])[1] || '',
  };
}

async function main() {
  const attempts = [];
  for (let i = 1; i <= 3; i++) {
    try {
      const result = await checkOnce();
      attempts.push(result);
      if (result.status < 400 && result.markers && !result.passwordLike) {
        console.log(JSON.stringify({ ok: true, attempts }, null, 2));
        process.exit(0);
      }
    } catch (err) {
      attempts.push({ status: 0, passwordLike: false, markers: false, error: String(err) });
    }
    if (i < 3) await sleep(1200 * i);
  }

  const persistent = attempts.every((a) => a.status === 0 || a.passwordLike || !a.markers);
  console.error(JSON.stringify({ ok: false, critical: persistent, attempts }, null, 2));
  process.exit(persistent ? 1 : 0);
}

void main();

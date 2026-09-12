/**
 * Cart UI regression — proves Shopify cart → UI → +/−/remove → refresh.
 * Usage: node scripts/cart-ui-audit.mjs [baseUrl]
 * Default: http://127.0.0.1:3000
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'http://127.0.0.1:3000';
const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
  { name: '1440x900', width: 1440, height: 900 },
];

function fail(msg) {
  console.error('FAIL:', msg);
  process.exit(1);
}

async function cartSnapshot(page) {
  return page.evaluate(() => {
    const heading = document.querySelector('h1')?.textContent || '';
    const qtySpans = [...document.querySelectorAll('button[aria-label="Decrease quantity"]')].map(
      (btn) => btn.parentElement?.querySelector('span')?.textContent?.trim() || null
    );
    const prices = [...document.querySelectorAll('.text-price')].map((el) => el.textContent || '');
    const body = document.body.innerText;
    return { heading, qtySpans, prices, body: body.slice(0, 800) };
  });
}

async function runFlow(page, label) {
  console.log('\n===', label, '===');
  await page.goto(`${BASE}/shop`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3500);

  const productLink = page.locator('a[href^="/shop/"]').first();
  if ((await productLink.count()) === 0) fail(`${label}: no product links`);
  const href = await productLink.getAttribute('href');
  await page.goto(`${BASE}${href}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(3000);

  const addBtn = page.getByRole('button', { name: /add to cart/i });
  if ((await addBtn.count()) === 0) fail(`${label}: no add to cart`);
  await addBtn.click();
  await page.waitForTimeout(3500);

  await page.goto(`${BASE}/cart`, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);

  let snap = await cartSnapshot(page);
  console.log('after add', snap.heading, 'qtys', snap.qtySpans);

  if (!/Your Cart\s*\(\s*[1-9]/.test(snap.heading) && !/سلة/.test(snap.heading)) {
    // Allow Arabic title; also check qty spans
    if (!snap.qtySpans.some((q) => q && Number(q) >= 1)) {
      fail(`${label}: cart count not >= 1 after add — ${snap.heading} qtys=${JSON.stringify(snap.qtySpans)}`);
    }
  }
  if (!snap.qtySpans.some((q) => Number(q) === 1) && !snap.qtySpans.some((q) => Number(q) >= 1)) {
    fail(`${label}: line quantity not >= 1`);
  }
  if (/SAR\s*0(\.0+)?(\s|$)/.test(snap.body) && !snap.prices.some((p) => /SAR\s*[1-9]/.test(p))) {
    // Subtotal line might still say 0 if broken
    const subtotalBroken = /Subtotal[\s\S]{0,40}SAR\s*0(\.0+)?/i.test(snap.body);
    if (subtotalBroken) fail(`${label}: subtotal still SAR 0`);
  }

  const posts = [];
  page.on('request', (req) => {
    if (req.url().includes('/api/shopify/cart') && req.method() === 'POST') {
      posts.push(req.postData() || '');
    }
  });

  const inc = page.getByRole('button', { name: /increase quantity/i }).first();
  await inc.click();
  await page.waitForTimeout(2500);
  snap = await cartSnapshot(page);
  console.log('after +', snap.heading, 'qtys', snap.qtySpans, 'posts', posts.length);
  if (posts.length !== 1) {
    fail(`${label}: expected 1 browser POST on +, got ${posts.length}`);
  }
  if (!snap.qtySpans.some((q) => Number(q) >= 2)) {
    fail(`${label}: quantity did not reach 2 after +`);
  }

  await inc.click();
  await page.waitForTimeout(2500);
  snap = await cartSnapshot(page);
  console.log('after ++', snap.heading, 'qtys', snap.qtySpans);
  if (!snap.qtySpans.some((q) => Number(q) >= 3)) {
    fail(`${label}: quantity did not reach 3`);
  }

  const dec = page.getByRole('button', { name: /decrease quantity/i }).first();
  await dec.click();
  await page.waitForTimeout(2500);
  snap = await cartSnapshot(page);
  console.log('after -', snap.heading, 'qtys', snap.qtySpans);
  if (!snap.qtySpans.some((q) => Number(q) === 2)) {
    fail(`${label}: quantity not 2 after -`);
  }

  await page.getByRole('button', { name: /remove item/i }).first().click();
  await page.waitForTimeout(2500);
  snap = await cartSnapshot(page);
  console.log('after remove', snap.heading, snap.body.slice(0, 200));
  const empty =
    /empty|لا توجد|Your Cart\s*\(\s*0\s*\)/i.test(snap.body + snap.heading) ||
    snap.qtySpans.length === 0;
  if (!empty) fail(`${label}: cart not empty after remove`);

  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);
  snap = await cartSnapshot(page);
  const stillEmpty =
    snap.qtySpans.length === 0 || /empty|لا توجد/i.test(snap.body + snap.heading);
  if (!stillEmpty) fail(`${label}: cart not empty after refresh`);

  console.log(label, 'OK');
}

const browser = await chromium.launch({ headless: true });
try {
  // Fresh context per viewport; clear cart storage once before the flow (not on every nav).
  for (const vp of VIEWPORTS) {
    const context = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      isMobile: vp.width < 800,
      hasTouch: vp.width < 800,
    });
    const page = await context.newPage();
    await page.goto(BASE, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await page.evaluate(() => {
      try {
        localStorage.removeItem('layali-shopify-cart');
      } catch {
        // ignore
      }
    });
    await runFlow(page, vp.name);
    await context.close();
  }
  console.log('\nCART_UI_AUDIT_OK');
} finally {
  await browser.close();
}

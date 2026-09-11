import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await (
  await browser.newContext({
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
  })
).newPage();

await page.goto('http://127.0.0.1:3010/shop', { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);

const snap = async () =>
  page.evaluate(() => {
    const label = [...document.querySelectorAll('p')]
      .map((x) => x.textContent)
      .find((t) => /Page|صفحة/.test(t || ''));
    const hrefs = [...document.querySelectorAll('a[href^="/shop/"]')].map((a) =>
      a.getAttribute('href')
    );
    return { label, first: hrefs[0], count: hrefs.length };
  });

const before = await snap();
const next = page.locator('button[aria-label="Next"], button[aria-label="التالي"]');
console.log('before', before, 'nextCount', await next.count());
if (await next.count()) {
  await next.first().click();
  await page.waitForTimeout(1200);
}
console.log('after', await snap());
await browser.close();

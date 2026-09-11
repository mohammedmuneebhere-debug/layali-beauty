import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const ctx = await browser.newContext({
  viewport: { width: 360, height: 800 },
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

await page.goto('http://127.0.0.1:3010/', { waitUntil: 'domcontentloaded' });
await page.getByRole('button', { name: /open menu/i }).click();
await page.waitForTimeout(200);
const locked = await page.evaluate(() => document.body.style.overflow);
const expanded = await page.locator('button[aria-controls]').getAttribute('aria-expanded');
await page.keyboard.press('Escape');
await page.waitForTimeout(200);
const after = await page.locator('button[aria-controls]').getAttribute('aria-expanded');
const unlocked = await page.evaluate(() => document.body.style.overflow);
console.log({ locked, expanded, afterEscape: after, unlocked });

await page.goto('http://127.0.0.1:3010/shop', { waitUntil: 'networkidle' });
await page.waitForTimeout(3000);
const pageInfo = await page.evaluate(() => ({
  cards: document.querySelectorAll('a[href^="/shop/"]').length,
  hasPageLabel: document.body.innerText.includes('Page'),
}));
const next = page.getByRole('button', { name: /next/i });
if (await next.count()) {
  await next.first().click();
  await page.waitForTimeout(800);
}
const page2 = await page.evaluate(() => ({
  cards: document.querySelectorAll('a[href^="/shop/"]').length,
  hrefs: [...document.querySelectorAll('a[href^="/shop/"]')]
    .slice(0, 2)
    .map((a) => a.getAttribute('href')),
}));
console.log({ pageInfo, page2 });
await browser.close();

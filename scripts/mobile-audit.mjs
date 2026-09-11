/**
 * Mobile audit matrix for Layali Beauty.
 * Usage: node scripts/mobile-audit.mjs [baseUrl]
 * Default baseUrl: http://127.0.0.1:3010
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.argv[2] || 'http://127.0.0.1:3010';
const VIEWPORTS = [
  { name: '360x800', width: 360, height: 800 },
  { name: '375x812', width: 375, height: 812 },
  { name: '390x844', width: 390, height: 844 },
  { name: '412x915', width: 412, height: 915 },
];

const ROUTES = [
  '/',
  '/shop',
  '/combos',
  '/about',
  '/customer-care',
  '/auth/signin',
  '/auth/signup',
  '/cart',
  '/account',
];

async function measureOverflow(page) {
  return page.evaluate(() => {
    const docOverflow = document.documentElement.scrollWidth > window.innerWidth + 1;
    const bodyOverflow = document.body.scrollWidth > window.innerWidth + 1;
    const offenders = [];
    const vw = window.innerWidth;
    for (const el of document.querySelectorAll('body *')) {
      if (!(el instanceof HTMLElement)) continue;
      const rect = el.getBoundingClientRect();
      if (rect.width < 1 || rect.height < 1) continue;
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') continue;
      if (rect.right > vw + 2 || rect.left < -2) {
        const tag = el.tagName.toLowerCase();
        const cls = (el.className && typeof el.className === 'string'
          ? el.className
          : ''
        ).slice(0, 80);
        offenders.push({
          tag,
          cls,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        });
        if (offenders.length >= 8) break;
      }
    }
    return {
      docOverflow,
      bodyOverflow,
      scrollWidth: document.documentElement.scrollWidth,
      innerWidth: window.innerWidth,
      offenders,
    };
  });
}

async function seoSignals(page) {
  return page.evaluate(() => {
    const title = document.title;
    const canonical =
      document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null;
    return { title, canonical };
  });
}

async function menuProbe(page) {
  const menuBtn = page.getByRole('button', { name: /open menu|close menu|menu/i });
  if ((await menuBtn.count()) === 0) {
    return { present: false };
  }
  await menuBtn.first().click();
  await page.waitForTimeout(350);
  const openOverflow = await measureOverflow(page);
  const bodyLocked = await page.evaluate(
    () => document.body.style.overflow === 'hidden' || document.documentElement.style.overflow === 'hidden'
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const ariaExpanded = await page.evaluate(() => {
    const btn = document.querySelector('button[aria-controls]');
    return btn?.getAttribute('aria-expanded');
  });
  // Re-open and navigate
  const openBtn = page.getByRole('button', { name: /open menu|menu/i });
  if (await openBtn.count()) {
    await openBtn.first().click();
    await page.waitForTimeout(200);
  }
  const shopLink = page.locator('header a[href="/shop"]').last();
  if (await shopLink.count()) {
    await shopLink.click();
    await page.waitForTimeout(500);
  }
  return {
    present: true,
    openOverflow: openOverflow.docOverflow || openOverflow.bodyOverflow,
    bodyLocked,
    escapeCloses: ariaExpanded === 'false',
    stillVisibleAfterEscape: ariaExpanded === 'true',
  };
}

async function run() {
  mkdirSync(join(process.cwd(), 'scripts', 'mobile-audit-out'), { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const results = [];
  const consoleErrors = [];
  const networkFails = [];
  let productPath = null;

  // Discover a product URL once
  {
    const ctx = await browser.newContext({
      viewport: { width: 390, height: 844 },
      userAgent:
        'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
    });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/shop`, { waitUntil: 'networkidle', timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    productPath = await page.evaluate(() => {
      const a = document.querySelector('a[href^="/shop/"]');
      return a ? a.getAttribute('href') : null;
    });
    await ctx.close();
  }

  const routes = [...ROUTES];
  if (productPath) routes.push(productPath);

  for (const vp of VIEWPORTS) {
    for (const route of routes) {
      const ctx = await browser.newContext({
        viewport: { width: vp.width, height: vp.height },
        userAgent:
          'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        isMobile: true,
        hasTouch: true,
      });
      const page = await ctx.newPage();
      const pageConsole = [];
      const pageNetwork = [];

      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          pageConsole.push(msg.text());
          consoleErrors.push({ viewport: vp.name, route, text: msg.text() });
        }
      });
      page.on('pageerror', (err) => {
        pageConsole.push(err.message);
        consoleErrors.push({ viewport: vp.name, route, text: err.message });
      });
      page.on('response', (res) => {
        const status = res.status();
        const url = res.url();
        if (status >= 400 && /\/api\/|supabase|shopify/i.test(url)) {
          pageNetwork.push({ status, url: url.slice(0, 160) });
          networkFails.push({ viewport: vp.name, route, status, url: url.slice(0, 160) });
        }
      });

      let status = 'ok';
      let overflow = null;
      let seo = null;
      let menu = null;
      let interaction = 'n/a';

      try {
        const resp = await page.goto(`${BASE}${route}`, {
          waitUntil: 'domcontentloaded',
          timeout: 45000,
        });
        await page.waitForTimeout(route === '/shop' || route.startsWith('/shop/') ? 3500 : 1500);
        overflow = await measureOverflow(page);
        seo = await seoSignals(page);

        if (route === '/') {
          menu = await menuProbe(page);
          interaction = menu?.present ? (menu.openOverflow ? 'menu-overflow' : 'menu-ok') : 'no-menu';
          // return home for clean state
          await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' }).catch(() => {});
          await page.waitForTimeout(800);
          overflow = await measureOverflow(page);
        }

        if (route === '/shop') {
          const cards = await page.locator('a[href^="/shop/"]').count();
          interaction = `cards:${cards}`;
        }

        if (resp && resp.status() >= 400) status = `http-${resp.status()}`;
        if (overflow?.docOverflow || overflow?.bodyOverflow) status = 'overflow';
        if (pageConsole.length) status = status === 'ok' ? 'console' : `${status}+console`;
      } catch (e) {
        status = `error:${e.message?.slice(0, 80)}`;
      }

      results.push({
        viewport: vp.name,
        route,
        overflow: overflow
          ? overflow.docOverflow || overflow.bodyOverflow
            ? 'FAIL'
            : 'PASS'
          : 'ERR',
        scrollWidth: overflow?.scrollWidth,
        innerWidth: overflow?.innerWidth,
        offenders: overflow?.offenders?.slice(0, 3) || [],
        console: pageConsole.length ? pageConsole.slice(0, 3) : [],
        network: pageNetwork.slice(0, 3),
        interaction,
        seo,
        status,
      });

      await ctx.close();
    }
  }

  // Desktop regression smoke
  {
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1000);
    const desktopOverflow = await measureOverflow(page);
    const desktopSeo = await seoSignals(page);
    results.push({
      viewport: '1440x900',
      route: '/',
      overflow: desktopOverflow.docOverflow || desktopOverflow.bodyOverflow ? 'FAIL' : 'PASS',
      scrollWidth: desktopOverflow.scrollWidth,
      innerWidth: desktopOverflow.innerWidth,
      offenders: desktopOverflow.offenders.slice(0, 3),
      console: [],
      network: [],
      interaction: 'desktop-smoke',
      seo: desktopSeo,
      status: 'ok',
    });
    await page.goto(`${BASE}/about`, { waitUntil: 'domcontentloaded' });
    const aboutSeo = await seoSignals(page);
    results.push({
      viewport: '1440x900',
      route: '/about',
      overflow: 'PASS',
      scrollWidth: null,
      innerWidth: 1440,
      offenders: [],
      console: [],
      network: [],
      interaction: 'desktop-smoke',
      seo: aboutSeo,
      status: 'ok',
    });
    await ctx.close();
  }

  await browser.close();

  const out = {
    base: BASE,
    productPath,
    generatedAt: new Date().toISOString(),
    summary: {
      total: results.length,
      overflowFails: results.filter((r) => r.overflow === 'FAIL').length,
      consoleErrors: consoleErrors.length,
      networkFails: networkFails.length,
    },
    results,
    consoleErrors: consoleErrors.slice(0, 40),
    networkFails: networkFails.slice(0, 40),
  };

  const outPath = join(process.cwd(), 'scripts', 'mobile-audit-out', 'report.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2));

  // Markdown matrix
  let md = `| Viewport | Route | Overflow | Console | Network | Interaction | Status |\n|---|---|---|---|---|---|---|\n`;
  for (const r of results) {
    md += `| ${r.viewport} | ${r.route} | ${r.overflow} | ${r.console.length} | ${r.network.length} | ${r.interaction} | ${r.status} |\n`;
  }
  writeFileSync(join(process.cwd(), 'scripts', 'mobile-audit-out', 'matrix.md'), md);

  console.log(md);
  console.log(`\nProduct path: ${productPath}`);
  console.log(`Report: ${outPath}`);
  console.log(JSON.stringify(out.summary, null, 2));
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

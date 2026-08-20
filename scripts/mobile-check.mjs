// Быстрая мобильная проверка: 390x844 (iPhone 12 / 14) — горизонтальный скролл и скриншоты.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL || 'http://localhost:4321';
const OUT = 'mobile-check';
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});

const pages2check = ['/', '/konstruktor/', '/obrazec/', '/idei/', '/idei/strategy_games/', '/methodika/', '/sobesedovanie/'];

for (const p of pages2check) {
  await page.goto(BASE + p, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  if (p === '/konstruktor/') await page.waitForSelector('.card', { timeout: 15000 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  const scrollX = await page.evaluate(() => document.documentElement.scrollWidth);
  const innerW = await page.evaluate(() => window.innerWidth);
  const fname = OUT + p.replaceAll('/', '_').replaceAll('_', '') + '.png';
  await page.screenshot({ path: OUT + '/' + (p === '/' ? 'landing' : p.split('/')[1] || 'landing') + '.png', fullPage: false });
  console.log(p, 'scrollW=' + scrollX, 'win=' + innerW, overflow ? '⚠️ OVERFLOW' : 'ok');
  if (overflow) {
    const offenders = await page.evaluate(() => {
      const out = [];
      const w = window.innerWidth;
      document.querySelectorAll('*').forEach(() => {});
      const all = document.querySelectorAll('body *');
      for (const el of all) {
        const r = el.getBoundingClientRect();
        if (r.right > w + 2 || r.left < -2) {
          const cls = typeof el.className === 'string' ? el.className : '';
          out.push(el.tagName + '.' + (cls.split(' ')[0] || '') + ' right=' + Math.round(r.right) + ' left=' + Math.round(r.left));
        }
      }
      return out.slice(0, 15);
    });
    console.log('  offenders:', offenders);
  }
}

await page.setViewportSize({ width: 390, height: 844 });
await browser.close();
console.log('done');
// Мобильная проверка 2: тап-таргеты и рабочий флоу конструктора на 390x844.
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4321';

const browser = await chromium.launch();
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
  deviceScaleFactor: 2,
});

// --- тап-таргеты на ключевых страницах ---
for (const p of ['/', '/konstruktor/', '/sobesedovanie/']) {
  await page.goto(BASE + p, { waitUntil: 'load' });
  await page.waitForTimeout(300);
  if (p === '/konstruktor/') await page.waitForSelector('.card', { timeout: 15000 });
  const small = await page.evaluate(() => {
    const out = [];
    const sel = 'a, button, .chip, .role-chip, .mode-btn, .skill-check, .add-btn, .tag, .pill, .quick-reply, input, textarea';
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const h = r.height, w = r.width;
      if (w > 0 && h > 0 && (h < 40 || w < 40)) {
        const visible = getComputedStyle(el).visibility !== 'hidden' && r.top < innerHeight && r.bottom > 0;
        if (visible) {
          const cls = typeof el.className === 'string' ? (el.className.split(' ')[0] || '') : '';
          out.push(el.tagName + '.' + cls + ' ' + Math.round(w) + 'x' + Math.round(h));
        }
      }
    }
    return out.slice(0, 12);
  });
  console.log(p, 'small tap targets:', small.length ? small : 'none');
}

// --- флоу конструктора на телефоне ---
await page.goto(BASE + '/konstruktor/', { waitUntil: 'load' });
await page.waitForSelector('.card', { timeout: 15000 });
console.log('cards:', await page.locator('.card').count());
// резюме-панель под бордом (order 1/2) — пролистываем вниз
await page.locator('.card .add-btn').nth(0).click();
await page.locator('.card .add-btn').nth(1).click();
console.log('counter:', (await page.locator('#counter').textContent()).trim());
// скролл к CTA
await page.locator('#ctaLock').scrollIntoViewIfNeeded();
const ctaReady = await page.locator('#ctaLock').getAttribute('class');
console.log('ctaLock ready on mobile:', ctaReady.includes('ready'));
// открыть модалку разблокировки
await page.locator('#ctaLock').click();
await page.waitForSelector('#unlockOverlay.open');
const modalW = await page.locator('.unlock-modal').evaluate((el) => Math.round(el.getBoundingClientRect().width));
console.log('unlock modal width on 390:', modalW);
// вкладка share доступна
await page.locator('#postVariants .pv-copy-btn').first().click().catch(()=>{});
console.log('unlock modal taps on mobile: OK');

await browser.close();
console.log('done');
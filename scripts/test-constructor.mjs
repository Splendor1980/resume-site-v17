// E2E-проверка Astro-сборки: статические SEO-страницы + «остров»-конструктор.
// Просто: npm run build, потом npm run test:e2e   (сервер поднимет scripts/run-e2e.mjs).
// Или вручную: npx astro preview --port 4321, потом BASE_URL=http://localhost:4321 node scripts/test-constructor.mjs
import { chromium } from 'playwright';

const BASE = process.env.BASE_URL || 'http://localhost:4321';

function fail(msg) {
  console.log('FAIL: ' + msg);
  process.exit(1);
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

// ---- конструктор ----
await page.goto(BASE + '/konstruktor/', { waitUntil: 'load' });
await page.waitForSelector('.card', { timeout: 15000 });
const cards = await page.locator('.card').count();
console.log('cards rendered:', cards);
if (cards < 103) fail('expected 103 cards, got ' + cards);

// фильтр
await page.locator('#filters .chip').first().click();
const filtered = await page.locator('.card').count();
await page.locator('#filters .chip').first().click();
const restored = await page.locator('.card').count();
console.log('filter:', filtered, '-> restored:', restored);
if (restored !== 103) fail('filter restore broken: ' + restored);

// add/remove
await page.locator('.card .add-btn').nth(0).click();
await page.locator('.card .add-btn').nth(1).click();
let counter = (await page.locator('#counter').textContent()).trim();
if (counter !== 'Добавлено идей: 2') fail('counter: ' + counter);
const ctaClass = await page.locator('#ctaLock').getAttribute('class');
if (!ctaClass.includes('ready')) fail('ctaLock not ready');
await page.locator('.card .add-btn').nth(0).click(); // toggle обратно
console.log('add/remove + cta-lock: OK');

// режим "Навыки под профессию"
await page.getByRole('button', { name: 'Навыки под профессию' }).click();
await page.waitForSelector('.role-chip');
console.log('role chips:', await page.locator('.role-chip').count());
await page.locator('.role-chip').first().click();
await page.waitForSelector('.skill-check');
if ((await page.locator('.skill-check').count()) === 0) fail('no skills for role');
console.log('by-role mode: OK');

// режим "Помощник-подсказчик": поиск по базе (со 2-го сообщения)
await page.getByRole('button', { name: 'Помощник-подсказчик' }).click();
await page.waitForSelector('#chatLog .msg.bot');
await page.fill('#chatInput', 'играю в игры');
await page.click('#chatSend');
await page.waitForTimeout(800);
await page.fill('#chatInput', 'дота 2, катка, слежу за новинками');
await page.click('#chatSend');
await page.waitForTimeout(900);
const recs = await page.locator('#recBox .rec-card').count();
console.log('chat recommendations:', recs);
if (recs === 0) fail('no recommendations in chat');
await page.locator('#recBox .add-btn').first().click();
const afterChat = parseInt((await page.locator('#counter').textContent()).replace(/\D/g, ''), 10);
console.log('counter after add from chat:', afterChat);
if (afterChat < 2) fail('add from chat failed (counter=' + afterChat + ')');
console.log('chat mode: OK');

// шестерёнка-дровер
await page.click('#gearBtn');
await page.waitForSelector('#drawerOverlay.open');
if (!(await page.locator('.drawer h3').textContent()).trim()) fail('drawer empty');
await page.locator('.drawer-close').click();
console.log('drawer: OK');

// SEO-ссылка карточки -> статическая страница
const href = await page.locator('.card h3 a').first().getAttribute('href');
await page.goto(BASE + href, { waitUntil: 'load' });
const h1 = (await page.locator('h1').textContent()).trim();
console.log('static idea page h1:', h1.slice(0, 60));
if (!h1) fail('idea page empty');

// главная
await page.goto(BASE + '/', { waitUntil: 'load' });
if ((await page.locator('.mini-card').count()) < 4) fail('landing featured missing');
if (!(await page.locator('body').textContent()).includes('Частые вопросы')) fail('landing FAQ missing');
console.log('landing: OK');

// полный список идей
await page.goto(BASE + '/idei/', { waitUntil: 'load' });
const hrefs = await page.locator('.list-row').evaluateAll((els) =>
  [...new Set(els.map((e) => e.getAttribute('href')))]
);
console.log('unique idea hrefs on /idei/:', hrefs.length);
if (hrefs.length !== 103) fail('expected 103 unique idea links, got ' + hrefs.length);

console.log('CONSOLE ERRORS:', errors.length ? errors : 'none');
console.log('RESULT: PASS');
await browser.close();
process.exit(errors.length ? 2 : 0);
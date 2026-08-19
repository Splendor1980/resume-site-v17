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
const context = await browser.newContext({ permissions: ['clipboard-read', 'clipboard-write'], viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
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
// v5: рекомендации чата могли ранжироваться иначе из-за keywords — проверяем именно,
// что клик по НЕ добавленной рекомендации добавляет идею (counter растёт на 1).
const addBtns = page.locator('#recBox .add-btn');
const baseCounter = parseInt((await page.locator('#counter').textContent()).replace(/\D/g, ''), 10);
let clicked = false;
for (let i = 0; i < await addBtns.count(); i++) {
  const cls = await addBtns.nth(i).getAttribute('class');
  if (!cls.includes('added')) { await addBtns.nth(i).click(); clicked = true; break; }
}
if (clicked) await page.waitForTimeout(300);
const afterChat = parseInt((await page.locator('#counter').textContent()).replace(/\D/g, ''), 10);
console.log('counter after add from chat:', afterChat);
if (!clicked) fail('chat had no unadded recommendations at all');
if (afterChat !== baseCounter + 1) fail('add from chat failed (base=' + baseCounter + ', after=' + afterChat + ')');

// v5: «О себе» и «Проектный опыт» взяты из авторских вариантов (не resume_bullet/skills)
await page.goto(BASE + '/konstruktor/', { waitUntil: 'load' });
await page.waitForSelector('.card .add-btn');
await page.locator('.card .add-btn').nth(0).click();
await page.locator('.card .add-btn').nth(1).click();
await page.waitForSelector('.sheet textarea[data-profile-textarea="about"]');
const aboutVal = await page.locator('.sheet textarea[data-profile-textarea="about"]').inputValue();
const expVal = await page.locator('.sheet textarea[data-profile-textarea="exp"]').inputValue();
if (!aboutVal || !expVal) fail('v5 author fields empty (about/exp)');
if (aboutVal.includes('—') === false && expVal.includes('—') === false) fail('author variants look like plain lists');
console.log('sample about:', aboutVal.split('\n')[0].slice(0, 90));
console.log('sample exp  :', expVal.split('\n')[0].slice(0, 90));
console.log('v5 author variants in resume: OK');
console.log('chat mode: OK');

// шестерёнка-дровер
await page.click('#gearBtn');
await page.waitForSelector('#drawerOverlay.open');
if (!(await page.locator('.drawer h3').textContent()).trim()) fail('drawer empty');
await page.locator('.drawer-close').click();
console.log('drawer: OK');

// разблокировка PDF: модалка «Секунду, прежде чем скачать» + кнопки копирования
await page.evaluate(() => localStorage.clear());
await page.goto(BASE + '/konstruktor/', { waitUntil: 'load' });
await page.waitForSelector('.card');
if ((await page.locator('.card').count()) < 103) fail('cards missing after reload');
await page.locator('.card .add-btn').nth(0).click();
await page.locator('.card .add-btn').nth(1).click();
const ctaBefore = await page.locator('#ctaLock').getAttribute('class');
if (!ctaBefore.includes('ready')) fail('ctaLock not ready before unlock');
await page.click('#ctaLock');
await page.waitForSelector('#unlockOverlay.open');
await page.click('#postVariants .pv-copy-btn');
await page.waitForSelector('#postVariants .pv-copy-btn:has-text("Скопировано")', { timeout: 5000 });
const vkHref = await page.locator('#postVariants .pv-vk-btn').first().getAttribute('href');
if (!vkHref || !vkHref.includes('vk.com/share.php')) fail('vk share button missing');
await page.fill('#postLinkInput', 'https://vk.com/wall1_2');
await page.click('#confirmShareBtn');
await page.waitForSelector('#unlockOverlay:not(.open)', { state: 'attached', timeout: 8000 });
const unlocked = await page.evaluate(() => !!localStorage.getItem('resumeSiteUnlockedAt'));
if (!unlocked) fail('unlock did not persist to localStorage');
console.log('unlock modal + copy buttons: OK');

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

// страница «Образец резюме»
await page.goto(BASE + '/obrazec/', { waitUntil: 'load' });
if (!(await page.locator('body').textContent()).includes('3') && (await page.locator('.sample-resume').count()) < 3)
  fail('obrazec samples missing');
if ((await page.locator('.sample-resume').count()) !== 3) fail('expected 3 samples, got ' + await page.locator('.sample-resume').count());
if ((await page.locator('.sample-resume a.idea-link').count()) !== 7) fail('idea-links on obrazec missing');
console.log('obrazec: OK');

// страница «Собеседование без опыта» (гайд-инструкция)
await page.goto(BASE + '/sobesedovanie/', { waitUntil: 'load' });
const guideH1 = (await page.locator('h1').textContent()).trim();
if (!guideH1) fail('guide page empty');
if (!(await page.locator('#printPdfBtn').count())) fail('guide PDF button missing');
if ((await page.locator('.idea-panel').count()) < 8) fail('guide panels missing (need >=8)');
if (!(await page.locator('body').textContent()).includes('протестируй')) fail('guide test-yourself call missing');
const guideText = await page.locator('body').textContent();
for (const author of ['Карнеги', 'Гоулстона', 'Гоулман', 'Синек', 'Ивановой', 'Чалдини', 'Восс', 'Батырев', 'Якуба']) {
  if (!guideText.includes(author)) fail('guide missing author: ' + author);
}
for (const cred of ['Dale Carnegie Training', 'ФБР', 'UCLA', 'New York Times', 'RAND', 'Johnson & Johnson', 'HPS', 'Tom Hunt']) {
  if (!guideText.includes(cred)) fail('guide missing credential: ' + cred);
}
const navHasGuide = (await page.locator('.site-nav-links a').allTextContents()).some((t) => t.includes('Собеседование'));
if (!navHasGuide) fail('guide link missing in header nav');
console.log('sobesedovanie guide: OK');

// бонус-пузырь на конструкторе ссылается на гайд
await page.goto(BASE + '/konstruktor/', { waitUntil: 'load' });
await page.waitForSelector('.card');
await page.click('.card .add-btn'); // не дожидаемся разблокировки — проверяем наличие ссылки в разметке пузыря
const bonusGuideHref = await page.locator('#bonusBubble a[href="/sobesedovanie/"]').getAttribute('href');
if (!bonusGuideHref) fail('bonus bubble guide link missing');
console.log('bonus bubble -> guide link: OK');

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
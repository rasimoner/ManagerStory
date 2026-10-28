import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pagesServer } from './pages-server.mjs';

const server = await pagesServer(process.argv[2] || 'dist', { port: 0 });
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const problems = [];
page.on('pageerror', error => problems.push(error.message));

async function holdPlayerOnPhone() {
  await page.locator('[data-speed="0.25"]').click();
  await page.waitForFunction(() => document.querySelector('[data-ball]')?.dataset.ballOwner);
  await page.locator('[data-command="play"]').click();
  const owner = await page.locator('[data-ball]').getAttribute('data-ball-owner');
  const player = page.locator(`[data-player="${owner}"]`);
  await player.scrollIntoViewIfNeeded();
  const bounds = await player.boundingBox();
  const touch = await page.context().newCDPSession(page);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 }] });
  await page.waitForTimeout(650);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  assert.match(await page.locator('#ball-source').textContent(), /sürmeye zorlandı/);
  assert.equal(await page.locator('#lab-auto').isChecked(), true, 'long press does not send a tap pass');
  await page.locator('[data-command="play"]').click();
  await page.waitForSelector('[data-dribble-direction]');
  await page.waitForFunction(() => Number(document.querySelector('[data-stat="dribbles"]').textContent) > 0);
}

async function verifyDuelsAndLog() {
  await page.locator('[data-command="finish"]').click();
  await page.waitForFunction(() => document.querySelector('#lab-clock').dataset.tick === '54000');
  const tackles = await page.locator('[data-stat="tackles"]').textContent();
  assert.ok(tackles.split('/').map(Number).reduce((sum, count) => sum + count, 0) > 0);
  assert.ok(await page.locator('#lab-events li').count() <= 10);
  assert.equal(await page.locator('[data-stat="fouls"]').count(), 1);
  assert.equal(await page.locator('[data-stat="yellow"]').count(), 1);
  assert.equal(await page.locator('[data-stat="red"]').count(), 1);
  assert.equal(await page.locator('[data-stat="advantages"]').count(), 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await page.evaluate(() => localStorage.getItem('msv4')), null);
  assert.equal(await page.locator('#lab-error').isVisible(), false);
}

try {
  await page.goto(server.url + 'lab.html');
  await page.waitForSelector('[data-player]');
  await holdPlayerOnPhone();
  await verifyDuelsAndLog();
  assert.deepEqual(problems, []);
  console.log('ok   duels laboratory: native touch long press, forced physical carry, decision arrow, duel stats, last ten events, full match, no career writes');
} finally {
  await browser.close();
  await server.close();
}

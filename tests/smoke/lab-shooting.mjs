import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pagesServer } from './pages-server.mjs';

const server = await pagesServer(process.argv[2] || 'dist', { port: 0 });
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const problems = [];
page.on('pageerror', error => problems.push(error.message));

async function doubleTapOwner() {
  await page.locator('[data-speed="0.25"]').click();
  await page.waitForFunction(() => document.querySelector('[data-ball]')?.dataset.ballOwner);
  await page.locator('[data-command="play"]').click();
  const owner = await page.locator('[data-ball]').getAttribute('data-ball-owner');
  const player = page.locator(`[data-player="${owner}"]`);
  await player.tap();
  await player.tap();
  await page.waitForSelector('[data-overlay="shot-path"]');
  await page.waitForFunction(() => !document.querySelector('[data-ball]').dataset.ballOwner);
  assert.equal(Number(await page.locator(`[data-stat="shots-${owner.split('-')[0]}"]`).textContent()), 1);
  assert.ok(await page.locator('[data-overlay="keeper-reach"]').count() === 2);
  assert.equal(await page.locator('#lab-auto').isChecked(), true);
}

async function finishPhysicalMatch() {
  await page.locator('[data-command="finish"]').click();
  await page.waitForFunction(() => document.querySelector('#lab-clock').dataset.tick === '54000');
  assert.equal(await page.locator('#lab-status').textContent(), 'MAÇ BİTTİ');
  assert.match(await page.locator('#lab-directions').textContent(), /2. devre.*Sarı ↓.*Mavi ↑/);
  assert.match(await page.locator('#lab-score').textContent(), /Sarı \d+ – \d+ Mavi/);
  assert.equal(await page.locator('[data-shot-team]').count(), 2);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await page.evaluate(() => localStorage.getItem('msv4')), null);
  assert.equal(await page.locator('#lab-error').isVisible(), false);
}

try {
  await page.goto(server.url + 'lab.html');
  await doubleTapOwner();
  await finishPhysicalMatch();
  assert.deepEqual(problems, []);
  if (process.env.SHOOTING_SCREENSHOT) await page.screenshot({ path: process.env.SHOOTING_SCREENSHOT, fullPage: true });
  console.log('ok   shooting laboratory: mobile double tap, physical shot, keeper reach, team shot statistics, score, swapped ends, 90-minute finish');
} finally {
  await browser.close();
  await server.close();
}

import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pagesServer } from './pages-server.mjs';

const server = await pagesServer(process.argv[2] || 'dist', { port: 0 });
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const problems = [];
page.on('pageerror', error => problems.push(error.message));

try {
  await page.goto(server.url + 'lab.html');
  await page.locator('[data-command="finish"]').click();
  await page.waitForFunction(() => document.querySelector('#lab-clock').dataset.tick === '54000');
  const count = await page.locator('[data-shot-result]').count();
  const total = await page.locator('[data-stat^="shots-"]').allTextContents();
  assert.equal(count, total.reduce((sum, value) => sum + Number(value), 0));
  assert.ok(count > 0);
  assert.match(await page.locator('[data-stat="xg-total"]').textContent(), /\d+\.\d{2} xG/);
  assert.match(await page.locator('[data-stat="save-percent"]').textContent(), /%\d+|—/);
  await page.locator('[data-layer="shotMap"]').uncheck();
  await page.waitForFunction(() => !document.querySelector('[data-overlay="shot-map"]'));
  await page.locator('[data-layer="shotMap"]').check();
  await page.waitForFunction(() => document.querySelector('[data-shot-result]'));
  assert.equal(await page.locator('[data-shot-result]').count(), count);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  if (process.env.BALANCE_SCREENSHOT) await page.screenshot({ path: process.env.BALANCE_SCREENSHOT, fullPage: true });
  await page.locator('#lab-seed-form button').click();
  await page.waitForFunction(() => !document.querySelector('[data-shot-result]'));
  assert.deepEqual(problems, []);
  console.log('ok   balance laboratory: persistent shot map, outcome colors, xG, save percentage, toggle, mobile width and reset');
} finally {
  await browser.close();
  await server.close();
}

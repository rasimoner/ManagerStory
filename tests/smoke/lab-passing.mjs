import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pagesServer } from './pages-server.mjs';

const server = await pagesServer(process.argv[2] || 'dist', { port: 0 });
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const problems = [];
page.on('pageerror', error => problems.push(error.message));

async function testManualPass() {
  await page.locator('[data-speed="0.25"]').click();
  await page.waitForFunction(() => document.querySelector('[data-ball]')?.dataset.ballOwner);
  await page.locator('[data-command="play"]').click();
  const owner = await page.locator('[data-ball]').getAttribute('data-ball-owner');
  const team = owner.split('-')[0];
  const receiver = await page.locator(`[data-player^="${team}-"]`).evaluateAll((players, holder) => players.find(player => player.dataset.player !== holder && !player.dataset.player.endsWith('GK')).dataset.player, owner);
  await page.locator('#lab-lob').check();
  await page.locator(`[data-player="${receiver}"]`).tap();
  await page.waitForFunction(() => !document.querySelector('#lab-auto').checked);
  assert.equal(await page.locator('#lab-auto').isChecked(), false);
  await page.locator('[data-command="play"]').click();
  await page.waitForSelector(`[data-selected-pass][data-to-id="${receiver}"]`);
  await page.waitForSelector('[data-pass-arrival]');
  await page.waitForFunction(() => Number(document.querySelector('[data-stat="passes"]').textContent) > 0);
  await page.waitForSelector('[data-overlay="flight"]');
}

try {
  await page.goto(server.url + 'lab.html');
  await page.waitForSelector('[data-player]');
  await testManualPass();
  await page.locator('#lab-passing-style').selectOption('Kısa');
  await page.locator('[data-command="finish"]').click();
  await page.waitForFunction(() => document.querySelector('#lab-clock').dataset.matchSeconds === '5400');
  assert.match(await page.locator('#lab-benchmark').textContent(), /90 dk/);
  assert.ok(Number(await page.locator('[data-stat="passes"]').textContent()) > 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.equal(await page.locator('#lab-error').isVisible(), false);
  assert.deepEqual(problems, []);
  assert.equal(await page.evaluate(() => localStorage.getItem('msv4')), null);
  console.log('ok   passing laboratory: touch pass, lob, quarter speed, options, arrival times, flight, live stats, style, full 90 minutes, no career writes');
} finally {
  await browser.close();
  await server.close();
}

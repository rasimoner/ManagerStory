import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { pagesServer } from './pages-server.mjs';

const server = await pagesServer(process.argv[2] || 'dist', { port: 0 });
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, serviceWorkers: 'allow' });
const page = await context.newPage();
const problems = [];
page.on('pageerror', error => problems.push(error.message));
page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
page.on('requestfailed', request => problems.push(request.url() + ': ' + request.failure()?.errorText));

async function openFromControlledGame() {
  await page.goto(server.url);
  await page.waitForSelector('[data-action="newCareer"]');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(resolve => navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }));
  });
  await page.goto(server.url + 'lab.html');
  await page.waitForSelector('[data-player]');
  await page.waitForFunction(() => Number(document.querySelector('#lab-clock').dataset.tick) > 4);
  assert.equal(await page.locator('[data-player]').count(), 22);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  const cached = await page.evaluate(async () => {
    const cache = await caches.open((await caches.keys())[0]);
    return (await cache.keys()).map(request => new URL(request.url).pathname).filter(path => /\/lab(?:\/|\.html)/.test(path));
  });
  assert.deepEqual(cached, []);
}

async function pauseAndPlaceBall() {
  await page.locator('[data-command="play"]').click();
  await page.waitForFunction(() => document.querySelector('#lab-status').textContent === 'DURAKLATILDI');
  const tick = await page.locator('#lab-clock').getAttribute('data-tick');
  await page.waitForTimeout(250);
  assert.equal(await page.locator('#lab-clock').getAttribute('data-tick'), tick);
  const field = page.locator('#lab-field');
  const bounds = await field.boundingBox();
  await field.tap({ position: { x: bounds.width * 0.72, y: bounds.height * 0.48 } });
  await page.waitForFunction(() => !document.querySelector('#lab-auto').checked);
  const ball = () => page.locator('[data-ball] circle').last().getAttribute('cx');
  const position = await ball();
  await page.locator('[data-team="away"]').click();
  await page.waitForFunction(() => document.querySelector('[data-team="away"]').getAttribute('aria-pressed') === 'true');
  assert.equal(await ball(), position, 'ownership preserves a manually placed ball while paused');
  await page.locator('[data-command="play"]').click();
  await page.waitForFunction(before => Number(document.querySelector('#lab-clock').dataset.tick) > Number(before) + 6, tick);
  await page.locator('[data-speed="2"]').click();
  await page.waitForFunction(() => document.querySelector('[data-speed="2"]').getAttribute('aria-pressed') === 'true');
}

async function changeLayersAndSettings() {
  await page.locator('[data-layer="velocity"]').check();
  await page.locator('[data-layer="anchors"]').check();
  await page.waitForSelector('[data-overlay="velocity"]');
  await page.waitForSelector('[data-overlay="anchors"]');
  await page.locator('[data-layer="roles"]').uncheck();
  await page.waitForFunction(() => document.querySelectorAll('[data-role]').length === 0);
  await page.locator('#lab-press').selectOption('Yüksek');
  await page.locator('#lab-line').selectOption('Önde');
  await page.locator('#lab-formation').selectOption('4-4-2');
  await page.waitForSelector('[data-player="home-LST"]');
  await page.locator('#lab-away-formation').selectOption('4-4-2');
  await page.waitForSelector('[data-player="away-RST"]');
}

async function validateSeedInput() {
  await page.locator('#lab-seed').fill('123');
  await page.locator('#lab-seed-form button').click();
  assert.equal(await page.locator('[data-player]').count(), 22);
  await page.locator('#lab-seed').fill('9007199254740992');
  await page.locator('#lab-seed-form button').click();
  await page.waitForSelector('#lab-error:not([hidden])');
  await page.waitForTimeout(100);
  assert.equal(await page.locator('#lab-error').isVisible(), true, 'validation stays visible across render frames');
  await page.locator('#lab-seed').fill('0');
  await page.locator('#lab-seed-form button').click();
  await page.waitForSelector('#lab-error[hidden]', { state: 'attached' });
}

try {
  await openFromControlledGame();
  await pauseAndPlaceBall();
  await changeLayersAndSettings();
  await validateSeedInput();
  assert.deepEqual(problems, []);
  assert.equal(await page.evaluate(() => localStorage.getItem('msv4')), null);
  console.log('ok   laboratory: mobile, controlled worker, online-only assets, 22 players, touch, pause, speed, ownership, layers, tactics, formations, seed validation');
} finally {
  await context.close();
  await browser.close();
  await server.close();
}

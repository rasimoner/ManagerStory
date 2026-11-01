import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { pagesServer } from './pages-server.mjs';

const require = createRequire(import.meta.url);
const { loadGame } = require('../support/game.cjs');
const { restorationCareers } = require('../support/restoration-careers.cjs');
const api = loadGame({ quiet: true }).api, fixtures = restorationCareers();
const evidence = 'test-results/restoration-phase2';
mkdirSync(evidence, { recursive: true });
const server = await pagesServer(process.argv[2] || 'dist', { port: 0 });
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [], captures = [];

async function savedState(page) {
  return api.unpackMatchSnapshot(await page.evaluate(() => JSON.parse(localStorage.getItem('msv4')).activeMatchV71)).simulationCheckpoint.state;
}

async function captureScene(label, storage) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    storageState: { cookies: [], origins: [{ origin: new URL(server.url).origin, localStorage: [{ name: 'msv4', value: storage }] }] } });
  const page = await context.newPage();
  page.on('pageerror', error => problems.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(server.url);
  await page.waitForFunction(() => document.querySelector('[data-scene-loading]')?.hidden);
  const expected = api.unpackMatchSnapshot(JSON.parse(storage).activeMatchV71).simulationCheckpoint.state;
  assert.deepEqual(await savedState(page), expected, 'opening the actual 3D view never advances its checkpoint');
  await verifyCaption(page, label, expected);
  await page.screenshot({ path: evidence + '/' + label + '.png', fullPage: true });
  if (['chest', 'head'].includes(label)) await verifyDescent(page, expected);
  captures.push({ label, tick: expected.tick, height: expected.ball.height, physicsTime: expected.physicsTime });
  await context.close();
  console.log('ok   phase 2 actual WebGL: ' + label);
}

async function verifyCaption(page, label, expected) {
  const labels = { throwIn: 'Taç', corner: 'Korner', goalKick: 'Aut', freeKick: 'Serbest vuruş', penalty: 'Şut', skill: 'Yön değiştirme' };
  if (label === 'freeKick' && expected.ball.shot?.freeKick) labels.freeKick = 'Şut';
  if (labels[label]) assert.equal(await page.locator('.sim-scene-caption').textContent(), labels[label]);
  const scene = page.locator('[data-sim-scene]'), canvas = scene.locator('canvas.career3d-scene');
  const [bounds, drawn] = await Promise.all([scene.boundingBox(), canvas.boundingBox()]);
  assert.ok(Math.abs(bounds.height - drawn.height) < 2);
}

async function verifyDescent(page, before) {
  await page.locator('[data-action="resumeLive"]').click();
  await page.waitForFunction(tick => {
    if (Number(document.querySelector('[data-sim-scene]')?.dataset.simTick) < tick + 2) return false;
    document.querySelector('[data-action="pauseLive"]').click(); return true;
  }, before.tick);
  const after = await savedState(page);
  assert.ok(after.ball.height >= 0 && after.ball.height < before.ball.height);
  assert.deepEqual(after.match.score, before.match.score);
}

try {
  for (const [label, storage] of Object.entries(fixtures)) await captureScene(label, storage);
  assert.deepEqual(problems, []);
  writeFileSync(evidence + '/verification.json', JSON.stringify({ node: process.version, viewport: [390, 844], captures, problems }, null, 2) + '\n');
} finally { await browser.close(); await server.close(); }

import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { pagesServer } from './pages-server.mjs';

const require = createRequire(import.meta.url), { remainingParityCareer } = require('../support/remaining-parity-careers.cjs');
const directory = 'test-results/remaining-contact-frames'; mkdirSync(directory, { recursive: true });
const server = await pagesServer('dist', { port: 0 });
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const results = [], problems = [];

async function captureContact(kind, viewport) {
  const fixture = remainingParityCareer(kind, 1, { contact: true });
  const orientation = viewport.width > viewport.height ? 'landscape' : 'portrait', name = `${kind}-${orientation}`;
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true,
    storageState: { cookies: [], origins: [{ origin: new URL(server.url).origin, localStorage: [{ name: 'msv4', value: fixture.save }] }] } });
  const page = await context.newPage(); page.on('pageerror', error => problems.push(error.message));
  try {
    await page.goto(server.url); await page.waitForFunction(() => document.querySelector('[data-scene-loading]')?.hidden);
    await page.locator('[data-scene-full]').click();
    await page.waitForFunction(() => document.querySelector('[data-sim-scene]')?.dataset.simCameraSettling !== 'true');
    const tick = await page.locator('[data-sim-scene]').getAttribute('data-sim-tick');
    assert.equal(Number(tick), fixture.startTick, 'the paused real career loads the exact core contact checkpoint');
    assert.ok(tick !== null, 'the actual live tick attribute exists');
    assert.equal(await page.locator('[data-scene-pause]').textContent(), 'Devam et');
    await verifyContactLayout(page);
    await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
    assert.equal(await page.locator('[data-sim-scene]').getAttribute('data-sim-tick'), tick);
    results.push({ ...fixture, save: undefined, name, viewport, tick, evidence: 'static WebGL frame only' });
    console.log(`ok   paused real contact frame: ${name}, tick ${tick}`);
  } finally { await context.close(); }
}

async function verifyContactLayout(page) {
  const cameras = await page.locator('.sim-scene-cameras').boundingBox(), controls = await page.locator('.sim-scene-controls').boundingBox();
  assert.ok(cameras.y + cameras.height <= controls.y);
  const version = await page.locator('canvas.career3d-scene').evaluate(canvas => {
    const gl = canvas.getContext('webgl2'); return gl?.getParameter(gl.VERSION);
  });
  assert.match(version, /^WebGL 2.0/);
}

try {
  // The two failed open-cross/replay runs remain red; these independent contacts do not rerun or replace them.
  const kinds = ['header', 'headpass', 'clearance', 'volley', 'stepover', 'nutmeg', 'elastico', 'cruyff', 'croqueta',
    'roulette', 'dragBack', 'sombrero', 'backheel', 'rabona', 'nolook', 'flairpass', 'trap'];
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    for (const kind of kinds) await captureContact(kind, viewport);
  }
  assert.deepEqual(problems, []);
} finally {
  writeFileSync(`${directory}/verification.json`, JSON.stringify({ results, problems, physicalSafariTest: false,
    browser: 'Chromium with real SwiftShader WebGL2', dynamicDeliveryGate: 'still failed; these static frames do not verify animation or replay completion' }, null, 2) + '\n');
  await browser.close(); await server.close();
}

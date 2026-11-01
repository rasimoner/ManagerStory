import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { pagesServer } from './pages-server.mjs';

const require = createRequire(import.meta.url), { remainingParityCareer } = require('../support/remaining-parity-careers.cjs');
const directory = 'test-results/remaining-parity'; mkdirSync(directory, { recursive: true });
const server = await pagesServer('dist', { port: 0 });
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const previous = process.env.REMAINING_RESUME && existsSync(`${directory}/verification.json`)
  ? JSON.parse(readFileSync(`${directory}/verification.json`, 'utf8')) : {};
const results = previous.results ?? [], problems = previous.problems ?? [], failures = previous.failures ?? [];

async function film(kind, viewport, direction = 1) {
  const fixture = remainingParityCareer(kind, direction), orientation = viewport.width > viewport.height ? 'landscape' : 'portrait';
  const name = `${kind}-${fixture.direction}-${orientation}`;
  if (results.some(result => result.name === name)) { console.log(`kept completed WebGL: ${name}`); return; }
  const { context, page } = await openRemainingPage(fixture, viewport);
  try {
    const start = await openRemainingScene(page, name);
    await page.locator('[data-scene-pause]').click();
    if (kind === 'automaticReplay') await verifyAutomaticReplay(page, name);
    else { await captureRemainingContact(page, { start, kind, name }); await runRemainingSequence(page, start, kind); }
    await page.screenshot({ path: `${directory}/${name}.png`, fullPage: true });
    results.push({ ...fixture, save: undefined, name, viewport, tickAttribute: 'data-sim-tick', sequenceVerified: true,
      lastTick: await page.locator('[data-sim-scene]').getAttribute('data-sim-tick'),
      caption: await page.locator('.sim-scene-caption').textContent() });
    writeRemainingManifest();
  } catch (error) {
    failures.push({ name, error: error.message }); writeRemainingManifest(); throw error;
  } finally {
    await closeRemainingVideo({ page, context, name });
  }
  console.log(`ok   remaining parity WebGL: ${name} (${fixture.category})`);
}

async function openRemainingPage(fixture, viewport) {
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, recordVideo: { dir: directory, size: viewport },
    storageState: { cookies: [], origins: [{ origin: new URL(server.url).origin, localStorage: [{ name: 'msv4', value: fixture.save }] }] } });
  const page = await context.newPage(); page.on('pageerror', error => problems.push(error.message)); page.on('dialog', dialog => dialog.accept());
  return { context, page };
}

async function closeRemainingVideo({ page, context, name }) {
  const video = page.video(); await context.close(); await video.saveAs(`${directory}/${name}.webm`); await video.delete();
}

async function openRemainingScene(page, name) {
  await page.goto(server.url); await page.waitForFunction(() => document.querySelector('[data-scene-loading]')?.hidden);
  await page.locator('[data-scene-full]').click(); await verifyRemainingLayout(page);
  await page.screenshot({ path: `${directory}/${name}-setup.png`, fullPage: true });
  const value = await page.locator('[data-sim-scene]').getAttribute('data-sim-tick');
  assert.ok(value !== null, 'the actual live tick attribute exists');
  return Number(value);
}

async function verifyRemainingLayout(page) {
  const cameras = await page.locator('.sim-scene-cameras').boundingBox(), controls = await page.locator('.sim-scene-controls').boundingBox();
  assert.ok(cameras.y + cameras.height <= controls.y, 'camera controls remain separate from match controls');
  const size = page.viewportSize(), canvas = await page.locator('canvas.career3d-scene').boundingBox();
  assert.ok(canvas.width <= size.width + 1 && canvas.height <= size.height + 1);
}

async function captureRemainingContact(page, { start, kind, name }) {
  if (kind === 'normalCareer') return;
  const offsets = { turnRelease: 12, corner: 8, shortCorner: 5, freeKickService: 8, openCross: 10,
    header: 1, headpass: 1, clearance: 1, volley: 1, stepover: 5, nutmeg: 6, elastico: 4, cruyff: 5,
    croqueta: 5, roulette: 12, dragBack: 4, sombrero: 4, backheel: 12, rabona: 14, nolook: 5, flairpass: 7, trap: 4 };
  await page.waitForFunction(tick => Number(document.querySelector('[data-sim-scene]')?.dataset.simTick) >= tick, start + offsets[kind]);
  await page.screenshot({ path: `${directory}/${name}-contact.png`, fullPage: true });
}

async function runRemainingSequence(page, start, kind) {
  const steps = kind === 'normalCareer' ? 60 : 24;
  await page.waitForFunction(target => {
    const scene = document.querySelector('[data-sim-scene]');
    if (scene?.dataset.simReplaying === 'true' || Number(scene?.dataset.simTick) < target) return false;
    document.querySelector('[data-scene-pause]')?.click(); return true;
  }, start + steps, { timeout: 45000 });
}

async function verifyAutomaticReplay(page, name) {
  await page.waitForFunction(() => document.querySelector('[data-sim-scene]')?.dataset.simReplaying === 'true', null, { timeout: 30000 });
  const before = await replayLiveReadout(page);
  await page.screenshot({ path: `${directory}/${name}-recorded-replay.png`, fullPage: true });
  await page.waitForTimeout(350);
  assert.deepEqual(await replayLiveReadout(page), before, 'the real career tick, score, clock and saved football freeze through automatic replay');
  await page.waitForFunction(() => document.querySelector('[data-sim-scene]')?.dataset.simReplaying === 'false', null, { timeout: 30000 });
  await page.waitForFunction(tick => Number(document.querySelector('[data-sim-scene]')?.dataset.simTick) > tick, Number(before.tick));
  const after = await replayLiveReadout(page);
  assert.ok(Number(after.tick) <= Number(before.tick) + 5, 'return resumes at the next step without replay-wall-time catch-up');
  await page.locator('[data-scene-pause]').click();
}

async function replayLiveReadout(page) {
  return page.evaluate(() => ({ tick: document.querySelector('[data-sim-scene]')?.dataset.simTick,
    clock: document.querySelector('[data-scene-clock]')?.textContent, score: document.querySelector('[data-scene-score]')?.textContent,
    saved: localStorage.getItem('msv4') }));
}

async function filmReverseDirection(viewport) {
  if (process.env.REMAINING_CASES) return;
  for (const kind of ['turnRelease', 'corner', 'nutmeg', 'sombrero', 'automaticReplay']) await film(kind, viewport, -1);
}

function writeRemainingManifest() {
  writeFileSync(`${directory}/verification.json`, JSON.stringify({ results, problems, failures,
    status: failures.length ? 'blocked; failures retained' : 'completed selected cases only',
    tickMeasurementFinding: previous.tickMeasurementFinding,
    browser: 'Chromium with real SwiftShader WebGL2', physicalSafariTest: false }, null, 2) + '\n');
}

try {
  const all = ['turnRelease', 'corner', 'shortCorner', 'freeKickService', 'openCross', 'header', 'headpass', 'clearance', 'volley',
    'stepover', 'nutmeg', 'elastico', 'cruyff', 'croqueta', 'roulette', 'dragBack', 'sombrero', 'backheel', 'rabona', 'nolook', 'flairpass', 'trap', 'automaticReplay', 'normalCareer'];
  const selected = process.env.REMAINING_CASES?.split(',') ?? all;
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    for (const kind of selected) await film(kind, viewport);
    await filmReverseDirection(viewport);
  }
  assert.deepEqual(problems, []);
  assert.deepEqual(failures, [], 'retained delivery failures keep this gate red');
  assert.ok(results.every(result => result.tickAttribute === 'data-sim-tick'), 'old unmeasured captures are not verified sequences');
} finally {
  writeRemainingManifest();
  await browser.close(); await server.close();
}

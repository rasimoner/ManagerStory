import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { pagesServer } from './pages-server.mjs';

const require = createRequire(import.meta.url);
const { loadGame } = require('../support/game.cjs');
const { recordedSceneCareers } = require('../support/scene-careers.cjs');
const api = loadGame({ skip: ['main.js'], quiet: true }).api;
const fixtures = recordedSceneCareers(), evidence = process.env.SIM_3D_EVIDENCE || 'test-results/sim-3d';
mkdirSync(evidence, { recursive: true });
const server = await pagesServer(process.argv[2] || 'dist', { port: 0 });
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
let context, page;
const problems = [], captures = [];

async function installFixture(label) {
  await context?.close();
  context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true,
    storageState: { cookies: [], origins: [{ origin: new URL(server.url).origin, localStorage: [
      { name: 'msv4', value: fixtures[label] },
      { name: 'managerstory-nv-tune-v1', value: JSON.stringify({ player: 9, ball: .1, s1: 8, slowmo: .01 }) },
    ] }] } });
  page = await context.newPage();
  page.on('pageerror', error => problems.push(error.message));
  page.on('dialog', dialog => dialog.accept());
  await page.goto(server.url);
}

async function loadScene(label) {
  await installFixture(label);
  await page.waitForSelector('[data-sim-scene]');
  await page.waitForFunction(() => document.querySelector('[data-scene-loading]')?.hidden);
  const root = page.locator('[data-sim-scene]');
  assert.equal(Number(await root.getAttribute('data-sim-players')), 22);
  const expected = api.unpackMatchSnapshot(JSON.parse(fixtures[label]).activeMatchV71).simulationCheckpoint.state;
  assert.equal(Number(await root.getAttribute('data-sim-tick')), expected.tick, `${label} loaded its own checkpoint`);
  const layout = await root.evaluate(element => ({ height: element.clientHeight, canvasHeight: element.querySelector('.career3d-scene').clientHeight }));
  assert.ok(Math.abs(layout.height - layout.canvasHeight) < 2, 'the 3D canvas fills the phone pitch');
  await page.screenshot({ path: `${evidence}/${label}.png`, fullPage: true });
  captures.push({ label, tick: Number(await root.getAttribute('data-sim-tick')), physicsTime: Number(await root.getAttribute('data-sim-physics-time')) });
}

async function savedMatch() {
  return api.unpackMatchSnapshot(await page.evaluate(() => JSON.parse(localStorage.getItem('msv4')).activeMatchV71));
}

async function verifySwitchAndControls() {
  const before = await savedMatch();
  await page.locator('[data-action="setMatchView"][data-view="2d"]').click();
  await page.waitForSelector('[data-sim-pitch]');
  await page.locator('[data-action="setMatchView"][data-view="3d"]').click();
  await page.waitForSelector('[data-sim-scene]');
  const after = await savedMatch();
  assert.deepEqual(after.simulationCheckpoint, before.simulationCheckpoint);
  assert.equal(after.matchElapsedSeconds, before.matchElapsedSeconds);
  await verifyFullscreenSpeeds();
  await verifyLiveAndReload();
}

async function verifyFullscreenSpeeds() {
  await page.locator('[data-scene-full]').click();
  assert.equal(await page.locator('.sim-scene-full').count(), 1);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.screenshot({ path: `${evidence}/landscape-fullscreen.png` });
  await page.locator('[data-scene-speed="0.5"]').click();
  assert.equal((await savedMatch()).speed, .5);
  await page.locator('[data-scene-speed="2"]').click();
  assert.equal((await savedMatch()).speed, 2);
  await page.locator('[data-scene-full]').click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('[data-action="setMatchSpeed"][data-value="1"]').click();
}

async function verifyLiveAndReload() {
  await page.locator('[data-action="resumeLive"]').click();
  const tick = Number(await page.locator('[data-sim-scene]').getAttribute('data-sim-tick'));
  await page.waitForFunction(start => Number(document.querySelector('[data-sim-scene]')?.dataset.simTick) >= start + 20, tick);
  await page.locator('[data-action="pauseLive"]').click();
  const paused = await savedMatch();
  assert.ok(paused.simulationCheckpoint.state.tick - tick < 45, 'legacy s1=8 preference is ignored');
  await page.reload();
  await page.waitForSelector('[data-sim-scene]');
  assert.equal((await savedMatch()).simulationCheckpoint.state.tick, paused.simulationCheckpoint.state.tick);
}

async function verifyHalfAndEnd() {
  await installFixture('halftime');
  await page.screenshot({ path: `${evidence}/half-time.png`, fullPage: true });
  await page.locator('[data-action="startSecondHalf"]').click();
  await page.waitForSelector('[data-sim-scene]');
  await page.locator('[data-action="pauseLive"]').click();
  await page.screenshot({ path: `${evidence}/second-half.png`, fullPage: true });
  await page.locator('[data-action="resumeLive"]').click();
  await page.locator('[data-action="skipExperimentalMatch"]').click();
  await page.waitForSelector('[data-action="finishMatch"]', { timeout: 30000 });
  const final = await savedMatch();
  assert.equal(final.matchElapsedSeconds, 5400);
  assert.equal(final.simulationCheckpoint.state.match.phase, 'ended');
  await page.screenshot({ path: `${evidence}/full-time.png`, fullPage: true });
}

async function verifyFallback() {
  await loadScene('passing');
  const before = await savedMatch();
  await page.locator('[data-sim-scene] .career3d-scene').evaluate(canvas => {
    canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext();
  });
  await page.waitForSelector('[data-sim-pitch]');
  assert.match(await page.locator('[role="status"]').textContent(), /Aynı maç 2D/);
  const after = await savedMatch();
  assert.deepEqual(after.simulationCheckpoint, before.simulationCheckpoint);
  await page.screenshot({ path: `${evidence}/webgl-fallback.png`, fullPage: true });
}

try {
  for (const label of ['kickoff', 'passing', 'shot', 'save', 'goal']) await loadScene(label);
  assert.match(await page.locator('.sim-scene-caption').textContent(), /GOOOL/);
  await loadScene('passing');
  await verifySwitchAndControls();
  await verifyHalfAndEnd();
  await verifyFallback();
  assert.deepEqual(problems, []);
  writeFileSync(`${evidence}/verification.json`, JSON.stringify({ node: process.version, viewport: '390×844', captures,
    controls: ['view switch without a step', 'half/double speed', 'pause', 'reload', 'fullscreen', 'landscape', 'second half', '90:00', 'skip', 'WebGL fallback'],
    goalFixture: 'isolated core acceptance geometry; no production result override', physicalIphoneSafari: false }, null, 2));
  console.log('ok   experimental career 3D: real rig, physical ball, goal, controls, halftime, finish, reload and WebGL fallback');
} finally {
  await browser.close();
  await server.close();
}

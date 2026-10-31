import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { chromium } from 'playwright';
import { pagesServer } from './pages-server.mjs';

const require = createRequire(import.meta.url);
const { KEEPER_SCENARIOS, recordKeeperScenario, ordinaryKeeperCareer } = require('../support/keeper-recordings.cjs');
const evidence = process.env.KEEPER_EVIDENCE || 'test-results/keeper-animation';
mkdirSync(evidence, { recursive: true });
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
const event = process.env.GITHUB_EVENT_PATH ? JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')) : null;
const sourceHeadCommit = event?.pull_request?.head.sha ?? sourceCommit;
const result = await build({ configFile: false, logLevel: 'silent', build: { write: false, minify: false,
  lib: { entry: fileURLToPath(new URL('./keeper-fixture.mjs', import.meta.url)), formats: ['iife'], name: 'KeeperFixture' } } });
const output = Array.isArray(result) ? result[0] : result, script = output.output.find(item => item.type === 'chunk').code;
const server = await pagesServer(process.argv[2] || 'dist', { port: 0 });
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const problems = [], measurements = [];
let activePage;

async function isolatedVideo(recording, viewport) {
  const label = `${recording.label}-${viewport.width > viewport.height ? 'landscape' : 'portrait'}`;
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, recordVideo: { dir: evidence, size: viewport } });
  const page = await context.newPage();
  activePage = page;
  console.log(`start isolated WebGL recording: ${label}`);
  page.on('pageerror', error => problems.push(error.message));
  await page.route('**/__keeper-evidence', route => route.fulfill({ contentType: 'text/html', body: fixtureHtml() }));
  await page.goto(`${server.url}__keeper-evidence`);
  await page.addScriptTag({ content: script });
  await page.evaluate(value => globalThis.keeperEvidence.install(value), recording);
  await animateRecording(page, recording.seconds);
  const samples = await captureChain(page, recording, label);
  const video = page.video();
  await context.close();
  await video.saveAs(`${evidence}/${label}.webm`);
  await video.delete();
  measurements.push({ label, category: 'isolated engine scenario', source: recording.source, seed: recording.seed,
    events: recording.events.filter(event => ['save', 'goal', 'keeperDistribution'].includes(event.type)), samples });
  console.log(`ok   real WebGL keeper sequence: ${label}`);
}

function fixtureHtml() {
  return '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;background:#223c2a;overflow:hidden}canvas{display:block;width:100vw;height:100vh}output{position:absolute;left:8px;top:8px;right:8px;padding:10px;color:white;background:#101a25dc;white-space:pre-line;font:13px system-ui}</style><canvas></canvas><output></output>';
}

async function animateRecording(page, seconds) {
  await page.evaluate(duration => new Promise((resolve, reject) => {
    let time = 0, previous;
    const draw = timestamp => {
      if (previous != null) time += Math.min(.05, (timestamp - previous) / 1000);
      previous = timestamp;
      try { globalThis.keeperEvidence.drawAt(Math.min(duration, time)); }
      catch (error) { reject(error); return; }
      if (time >= duration) resolve();
      else requestAnimationFrame(draw);
    };
    requestAnimationFrame(draw);
  }), seconds);
}

async function captureChain(page, recording, label) {
  const samples = [];
  for (const time of [0, .34, .62, .95, 1.38, 1.68, 2.25, 2.8]) {
    const sample = await page.evaluate(at => globalThis.keeperEvidence.drawAt(at), time);
    assert.ok(sample.webgl.startsWith('WebGL 2.0'));
    assert.equal(sample.root[0], sample.expectedRoot[0]);
    assert.equal(sample.root[2], sample.expectedRoot[2]);
    assert.ok(Object.values(sample.bones).flat().every(Number.isFinite));
    if (sample.held) assert.ok(sample.gripGap < .02, 'the held mesh follows the gloves during the actual recovery');
    await page.screenshot({ path: `${evidence}/${label}-${time.toFixed(2)}.png` });
    samples.push(sample);
  }
  assert.ok(recording.events.some(event => ['save', 'goal'].includes(event.type)));
  return samples;
}

async function ordinaryCareerVideo(career, viewport) {
  const label = `ordinary-career-${viewport.width > viewport.height ? 'landscape' : 'portrait'}`;
  const context = await browser.newContext({ viewport, isMobile: true, hasTouch: true, recordVideo: { dir: evidence, size: viewport },
    storageState: { cookies: [], origins: [{ origin: new URL(server.url).origin, localStorage: [{ name: 'msv4', value: career.storage }] }] } });
  const page = await context.newPage();
  activePage = page;
  console.log(`start ordinary career recording: ${label}`);
  page.on('pageerror', error => problems.push(error.message));
  await page.goto(server.url);
  await page.waitForFunction(() => document.querySelector('[data-scene-loading]')?.hidden);
  if (viewport.width > viewport.height) await page.locator('[data-scene-full]').click();
  await page.locator(viewport.width > viewport.height ? '[data-scene-pause]' : '[data-action="resumeLive"]').click();
  await waitForCareerWindow(page, career.frames.at(-1).physicsTime);
  await page.locator(viewport.width > viewport.height ? '[data-scene-pause]' : '[data-action="pauseLive"]').click();
  await page.screenshot({ path: `${evidence}/${label}.png`, fullPage: true });
  const video = page.video();
  await context.close();
  await video.saveAs(`${evidence}/${label}.webm`);
  await video.delete();
  measurements.push({ label, category: 'ordinary career', source: career.source, save: career.save });
  console.log(`ok   actual career keeper sequence: ${label}`);
}

async function waitForCareerWindow(page, untilTime) {
  let previous = 0;
  while (previous < untilTime) {
    // Software WebGL may render slowly; fail on a stopped physical clock, not on total recording time.
    await page.waitForFunction(time => Number(document.querySelector('[data-sim-scene]')?.dataset.simPhysicsTime) > time,
      previous, { timeout: 30000 });
    previous = Number(await page.locator('[data-sim-scene]').getAttribute('data-sim-physics-time'));
  }
}

try {
  const recordings = KEEPER_SCENARIOS.map(recordKeeperScenario), career = ordinaryKeeperCareer();
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    for (const recording of recordings) await isolatedVideo(recording, viewport);
    await ordinaryCareerVideo(career, viewport);
  }
  assert.deepEqual(problems, []);
  writeFileSync(`${evidence}/verification.json`, JSON.stringify({ sourceCommit, sourceHeadCommit, node: process.version, physicalIphoneSafari: false, measurements }, null, 2));
} catch (error) {
  await activePage.screenshot({ path: `${evidence}/failure.png`, fullPage: true });
  const state = await activePage.evaluate(() => ({ scene: { ...document.querySelector('[data-sim-scene]')?.dataset },
    flat: { ...document.querySelector('[data-sim-pitch]')?.dataset }, clock: document.querySelector('#live-clock')?.textContent,
    visible: document.querySelector('#app')?.textContent, hidden: document.hidden }));
  writeFileSync(`${evidence}/failure.json`, JSON.stringify({ sourceCommit, error: error.message, state, problems, measurements }, null, 2));
  console.error('keeper recording stopped', state);
  throw error;
} finally {
  await browser.close();
  await server.close();
}

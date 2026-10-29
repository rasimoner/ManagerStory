import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
import { pagesServer } from './pages-server.mjs';

const require = createRequire(import.meta.url);
const { loadGame } = require('../support/game.cjs');
const api = loadGame({ skip: ['main.js'], quiet: true }).api;
const server = await pagesServer(process.argv[2] || 'dist', { port: 0 });
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
const page = await context.newPage(), problems = [], dialogs = [];
page.on('pageerror', error => problems.push(error.message));
page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });
page.on('dialog', async dialog => { if (dialog.type() === 'alert') dialogs.push(dialog.message()); await dialog.accept(); });

async function savedCareer() { return page.evaluate(() => JSON.parse(localStorage.getItem('msv4'))); }
async function savedMatch() { return api.unpackMatchSnapshot((await savedCareer()).activeMatchV71); }

async function prepareCareer() {
  await page.goto(server.url);
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await page.locator('[data-action="newCareer"]').click();
  await page.locator('[data-action="showSettings"]').click();
  await page.locator('[data-action="setExperimentalMatchEngine"]').check();
  assert.equal((await savedCareer()).schemaVersion, 4);
  await page.evaluate(() => { const career = JSON.parse(localStorage.getItem('msv4')); career.matchSalt = 73; localStorage.setItem('msv4', JSON.stringify(career)); });
  await page.reload();
  await enterMatchThroughCareer();
  await page.waitForSelector('[data-sim-pitch]');
  assert.equal(await page.locator('[data-action="setMatchView"][data-view="3d"]').count(), 0);
  assert.match(await page.locator('#app').textContent(), /Yeni motorda 3D yakında/);
}

async function enterMatchThroughCareer() {
  for (let step = 0; step < 20; step++) {
    const match = page.locator('[data-action="choose"][data-choice="match"]');
    if (await match.count()) { await match.click(); return; }
    const office = page.locator('[data-action="completeOfficeDay"]');
    if (await office.count()) { await office.click(); continue; }
    const reject = page.locator('[data-action="choose"][data-choice="reject"]');
    if (await reject.count()) await reject.click();
    else await page.locator('.decisiontray [data-action="choose"]').first().click();
  }
  throw new Error('The career decisions did not reach match day.');
}

async function makeSubstitution(required = false) {
  const career = await savedCareer(), match = api.unpackMatchSnapshot(career.activeMatchV71);
  const outId = required ? match.requiredSubstitution.playerId : match.active.at(-1);
  const eligible = career.players.filter(player => !match.active.includes(player.id) && !match.out.includes(player.id) && !match.sentOff.includes(player.id) && !player.injury && !['Kirada', 'Transfer oldu'].includes(player.status));
  if (!eligible.length) { await page.locator('[data-action="resumeLive"]').click(); return; }
  const incoming = eligible.find(player => player.pos.split('/').includes(match.matchRoles[outId])) ?? eligible[0];
  await page.locator('[data-action="subUI"]').first().click();
  if (!required) await page.locator('[data-action="subOut"][data-id="' + outId + '"]').click();
  await page.locator('[data-action="doSub"][data-id="' + incoming.id + '"]').click();
}

async function verifyControlsAndReload() {
  await page.waitForFunction(() => document.querySelector('#live-clock')?.textContent !== '00:00');
  await page.locator('[data-action="pauseLive"]').click();
  await verifyDisplayedTime(await savedMatch());
  await page.locator('[data-action="openDecisionSheet"]').click();
  await page.locator('[data-action="showMatchTactics"]').click();
  await page.locator('[data-action="setMatchTactic"][data-key="press"]').selectOption('Yüksek');
  await page.locator('[data-action="switchMatchTab"][data-key="pitch"]').click();
  await makeSubstitution();
  const current = await savedMatch();
  const command = current.simulationCheckpoint.state.events.findLast(event => event.type === 'tactics');
  assert.equal(command.tick, current.simulationCheckpoint.state.tick);
  await page.reload();
  await page.waitForSelector('[data-sim-pitch]');
  assert.equal((await savedMatch()).matchElapsedSeconds, current.matchElapsedSeconds);
  await page.locator('[data-action="resumeLive"]').click();
  await page.locator('[data-action="setMatchSpeed"][data-value="2"]').click();
  await page.locator('[data-action="skipExperimentalMatch"]').click();
  await waitForMatchEnd();
  await verifyCareerResult();
}

async function verifyDisplayedTime(match) {
  assert.equal(match.matchElapsedSeconds, match.simulationCheckpoint.state.time);
  assert.equal(Number(await page.locator('[data-sim-pitch]').getAttribute('data-sim-time')), match.matchElapsedSeconds);
}

async function handleMatchStop() {
  const half = page.locator('[data-action="startSecondHalf"]');
  if (await half.count()) { await half.click(); return; }
  const resume = page.locator('[data-action="resumeLive"]');
  if (!(await resume.count())) return;
  await makeSubstitution(true);
  if (await resume.count()) await resume.click();
}

async function waitForMatchEnd() {
  const started = Date.now();
  while (!(await page.locator('[data-action="finishMatch"]').count())) {
    await handleMatchStop();
    if (Date.now() - started > 900000) throw new Error('Continuous match exceeded fifteen minutes; record the measured duration.');
    await page.waitForTimeout(250);
  }
}

async function verifyCareerResult() {
  const match = await savedMatch();
  assert.equal(match.hg + match.ag, match.events.filter(event => event.type === 'goal').length);
  assert.equal(match.matchElapsedSeconds, 5400);
  assert.ok(Object.values(match.playerStats).some(row => row.minutes > 0));
  await page.locator('[data-action="finishMatch"]').click();
  const saved = api.restoreSimulationHistory(await savedCareer());
  assert.equal(saved.results.length, 1);
  assert.ok(saved.table.every(team => team.p === 1));
  const result = saved.results[0], ownGoals = result.matchSummary.userHome ? result.hg : result.ag;
  assert.equal(result.matchSummary.players.reduce((sum, row) => sum + row.goals, 0), ownGoals);
  assert.ok(saved.players.some(player => player.minutes > 0 && player.fitness < 100));
  assert.ok(saved.v71.lastMatch.events.some(event => event.type === 'shot'));
  assert.match(await page.locator('#app').textContent(), /Maç Sonu|Röportaj|Basın/);
}

async function startFrameMeasurement() {
  await page.evaluate(() => {
    const measurement = { running: true, intervals: [], longFrames: [], phases: {}, last: null, backwards: false, clock: 0 };
    globalThis.careerWatchMeasurement = measurement;
    function observe(now) {
      const pitch = document.querySelector('[data-sim-pitch]');
      if (pitch && measurement.running) {
        if (measurement.last != null) measurement.intervals.push(now - measurement.last);
        measurement.last = now;
        measurement.phases[pitch.dataset.playback] = (measurement.phases[pitch.dataset.playback] ?? 0) + 1;
        const [minute, second] = document.querySelector('#live-clock').textContent.split(':').map(Number);
        const clock = minute * 60 + second;
        const interval = measurement.intervals.at(-1);
        if (interval > 100) measurement.longFrames.push({ milliseconds: interval, gameSecond: clock, phase: pitch.dataset.playback,
          status: document.querySelector('.matchscore small')?.textContent });
        if (clock < measurement.clock) measurement.backwards = true;
        measurement.clock = clock;
      } else measurement.last = null;
      if (measurement.running) requestAnimationFrame(observe);
    }
    requestAnimationFrame(observe);
  });
}

async function measureContinuousMatch() {
  await prepareCareer();
  const session = await context.newCDPSession(page);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await startFrameMeasurement();
  const started = Date.now();
  await waitForMatchEnd();
  const milliseconds = Date.now() - started;
  const measurement = await page.evaluate(() => {
    const sample = globalThis.careerWatchMeasurement;
    sample.running = false;
    const sorted = [...sample.intervals].sort((left, right) => left - right);
    return { frames: sorted.length, medianFrameMs: sorted[Math.floor(sorted.length / 2)], p95FrameMs: sorted[Math.floor(sorted.length * .95)],
      maximumFrameMs: sorted.at(-1), longFrames: sample.longFrames.sort((left, right) => right.milliseconds - left.milliseconds).slice(0, 10),
      phases: sample.phases, backwards: sample.backwards };
  });
  const match = await savedMatch(), career = await savedCareer();
  const report = { milliseconds, seconds: milliseconds / 1000, node: process.version, cpuThrottle: 4, viewport: [390, 844], ...measurement,
    score: [match.hg, match.ag], savedUtf16Bytes: JSON.stringify(career).length * 2, simulationMetrics: match.simulationPlayback.metrics };
  writeFileSync(process.env.CAREER_METRICS || 'career-mobile-metrics.json', JSON.stringify(report, null, 2) + '\n');
  if (process.env.CAREER_SCREENSHOT) await page.screenshot({ path: process.env.CAREER_SCREENSHOT, fullPage: true });
  assert.equal(measurement.backwards, false);
  assert.ok(report.savedUtf16Bytes < 5 * 1024 * 1024, 'the match fits the mobile storage budget');
  assert.ok(milliseconds >= 360000 && milliseconds <= 600000, `actual continuous viewing took ${report.seconds.toFixed(1)} s; target 360–600 s`);
  await session.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await verifyCareerResult();
  console.log('ok   continuous 2D: ' + JSON.stringify(report));
}

try {
  await prepareCareer();
  await verifyControlsAndReload();
  console.log('ok   experimental career: switch, actual squads, immediate commands, substitutions, reload, skip, table and season summary');
  if (process.env.CAREER_CONTROLS_ONLY !== '1') await measureContinuousMatch();
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  assert.deepEqual(problems, []);
  assert.deepEqual(dialogs, []);
} finally {
  await browser.close();
  await server.close();
}

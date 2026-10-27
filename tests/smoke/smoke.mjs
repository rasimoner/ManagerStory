/* The smoke test: the built game (dist/) in a real browser, served the way GitHub Pages serves it (refactor E6).
   CI runs it on every build before publishing; `npm run smoke` after `npm run build`.
     1. it opens: the start screen, this release's title, no error;
     2. the main screens of a new career draw (home, league, squad, tactics, transfer, academy, settings);
     3. saves load: saves of older releases (from tests/fixtures/saves/legacy, made by those releases) and of this
        one at every moment a player can save (mid-season, after three seasons, the season-end summary);
     4. the season end goes on: the summary's button leads to the next step;
     5. the 3D match: a save from the middle of a match opens the match, the 3D view loads (three.js on demand)
        and the match plays on;
     6. a new release: when the next build's service worker takes over, the open page says "Yeni sürüm hazır" and
        its button reloads into it (the next build here: this one with another build id in its worker);
     7. offline: once the service worker has cached the release, the game opens with no network, and so does the
        3D match;
     8. the highlight archive: a save with highlights (two star-transfer clips of the old format, carried over by
        the save chain) opens the archive from the squad tab; "İzle" plays a highlight in 3D and it closes on its
        own, another is closed with its button.
   A console error, an uncaught exception or a failed request fails it.
   node tests/smoke/smoke.mjs [folder=dist]; SMOKE_CHROMIUM=<path> uses that Chromium instead of Playwright's. */
import { chromium } from 'playwright';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { pagesServer } from './pages-server.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const version = JSON.parse(readFileSync(ROOT + 'package.json', 'utf8')).version;
const fixture = name => readFileSync(`${ROOT}tests/fixtures/saves/${name}.json`, 'utf8');
// software WebGL: the 3D view needs a GPU context, and CI machines have none
const LAUNCH = { executablePath: process.env.SMOKE_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] };

const results = [];
async function step(name, run) {
  const started = Date.now();
  try { await run(); results.push({ name, ok: true }); console.log(`ok   ${name} (${((Date.now() - started) / 1000).toFixed(1)} s)`); }
  catch (error) { results.push({ name, ok: false }); console.log(`FAIL ${name}\n     ${String(error?.stack || error).split('\n').slice(0, 4).join('\n     ')}`); }
}
const check = (value, message) => { if (!value) throw new Error(message); };

/* A page that records what went wrong on it. */
async function open(context) {
  const page = await context.newPage();
  page.problems = [];
  page.on('console', m => { if (m.type() === 'error') page.problems.push(`console: ${m.text()}`); });
  page.on('pageerror', e => page.problems.push(`exception: ${e.message}`));
  page.on('requestfailed', r => { if (!page.offlineExpected) page.problems.push(`request failed: ${r.url()} ${r.failure()?.errorText}`); });
  page.on('response', r => { if (r.status() >= 400) page.problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  return page;
}
const clean = page => { check(page.problems.length === 0, page.problems.join('\n')); };
const text = async page => (await page.textContent('#app')).replace(/\s+/g, ' ');
async function loadSave(page, url, save) {
  await page.goto(url);
  await page.evaluate(value => { localStorage.clear(); localStorage.setItem('msv4', value); }, save);
  await page.reload();
  await page.waitForSelector('#app *');
}
const TABS = ['league', 'squad', 'plan', 'transfer', 'academy', 'home'];

const folder = process.argv[2] || 'dist';
const server = await pagesServer(folder, { port: 0 });
const browser = await chromium.launch(LAUNCH);
console.log(`smoke test: ${folder} at ${server.url}, release ${version}`);

const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
const page = await open(context);

await step('opens: start screen, title, no error', async () => {
  await page.goto(server.url);
  await page.waitForSelector('[data-action="newCareer"]');
  check((await page.title()).startsWith(`ManagerStory V${version} `), `title: ${await page.title()}`);
  check((await text(page)).includes(`V${version} • Hisar Matchday`), 'start screen label');
  clean(page);
});

await step('a new career: the main screens and the settings draw', async () => {
  await page.click('[data-action="newCareer"]');
  await page.waitForSelector('.bottomnav');
  for (const tab of TABS) {
    await page.click(`.bottomnav [data-action="goMain"][data-tab="${tab}"]`);
    await page.waitForSelector(`.bottomnav [data-tab="${tab}"].active`);
    check((await text(page)).length > 100, `${tab} drew nothing`);
  }
  await page.click('[data-action="showSettings"]');
  check((await text(page)).includes(`ManagerStory • V${version} • MatchEngine`), 'settings show the release');
  clean(page);
});

await step('the service worker caches the release', async () => {
  const cached = await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.ready;
    for (let i = 0; i < 100 && !navigator.serviceWorker.controller; i++) await new Promise(r => setTimeout(r, 100));
    const keys = await caches.keys();
    const cache = await caches.open(keys.find(k => k.startsWith('managerstory-v')));
    return { scope: registration.scope, keys, entries: (await cache.keys()).length, controlled: !!navigator.serviceWorker.controller };
  });
  check(cached.controlled, 'the page is controlled by the worker');
  check(cached.keys.length === 1 && cached.keys[0].startsWith(`managerstory-v${version}-`), `caches: ${cached.keys}`);
  check(cached.entries > 50, `${cached.entries} files cached`);
  check(!(await page.$('.updatenotice')), 'no "new release" notice on a first visit');
  clean(page);
});

for (const save of ['legacy/v7.8.2', 'legacy/v7.9.7', 'generated/mid-season', 'generated/after-three-seasons']) {
  await step(`a save loads: ${save}`, async () => {
    await loadSave(page, server.url, fixture(save));
    await page.waitForSelector('.bottomnav');
    check(!(await page.$('[data-action="newCareer"]')), 'the career opened, not the start screen');
    for (const tab of ['league', 'squad', 'home']) await page.click(`.bottomnav [data-action="goMain"][data-tab="${tab}"]`);
    clean(page);
  });
}

await step('the season end: the summary, then the next step', async () => {
  await loadSave(page, server.url, fixture('generated/season-end-summary'));
  await page.waitForSelector('[data-action="seasonEndNext"][data-step="summary"]');
  await page.click('[data-action="seasonEndNext"][data-step="summary"]');
  await page.waitForFunction(() => !document.querySelector('[data-action="seasonEndNext"][data-step="summary"]'));
  check((await page.$$('[data-action]')).length > 3, 'the next step drew');
  clean(page);
});

/* The match saved at 30:00 opens, the 3D view loads (its "3D saha hazırlanıyor…" cover goes) and the match plays
   on: the clock moves. (In software WebGL the view plays a minute's events slowly; the clock waits for it.) */
async function threeD(page) {
  await page.waitForSelector('canvas.career3d-scene', { timeout: 30000 });
  await page.waitForSelector('.nv-loading', { state: 'hidden', timeout: 60000 });
  const clock = () => page.evaluate(() => (/(\d+):(\d\d)/.exec(document.querySelector('#app').textContent) || [])[0]);
  const before = await clock();
  check(before === '30:00', `the match opens where it was saved (${before})`);
  if (await page.$('[data-action="resumeLive"]')) await page.click('[data-action="resumeLive"]');
  await page.waitForFunction(b => (/(\d+):(\d\d)/.exec(document.querySelector('#app').textContent) || [])[0] !== b, before, { timeout: 60000 });
}

await step('the 3D match: a save from the middle of a match opens it in 3D and it plays on', async () => {
  const requested = [];
  page.on('request', r => requested.push(r.url()));
  await loadSave(page, server.url, fixture('generated/mid-match'));
  await threeD(page);
  check(requested.some(u => /\/app\/three-[\w-]+\.js$/.test(u)), 'three.js was loaded on demand');
  clean(page);
});

// an old save carrying the star-transfer clips of V7.9.7 (the save chain turns them into recipes)
function saveWithHighlights() {
  const save = JSON.parse(fixture('generated/mid-season'));
  const star = save.players.find(p => p.pos !== 'GK' && p.status !== 'Transfer oldu'), keeper = save.players.find(p => p.pos === 'GK');
  const clip = (id, p, move) => ({ id, kind: 'star-transfer', playerId: p.id, playerName: p.name, pos: p.pos, move, stars: 5, keeper: p.pos === 'GK', fee: 1e7, fromClub: 'Rakip', season: save.season || '2025/26', week: 2, matchday: 2 });
  save.highlights = [clip('hl1', star, 'elastico'), clip('hl2', keeper, 'scorpion')];
  return JSON.stringify(save);
}

await step('the highlight archive: it opens from the squad tab, "İzle" plays a highlight in 3D and closes', async () => {
  await loadSave(page, server.url, saveWithHighlights());
  await page.click('.bottomnav [data-action="goMain"][data-tab="squad"]');
  await page.click('[data-action="showHighlights"]');
  await page.waitForSelector('#app h1:text("Highlight arşivi")');
  check((await page.$$('[data-action="watchHighlight"]')).length === 2, 'both highlights are in the archive');
  await page.click('[data-action="watchHighlight"][data-id="hl1"]');
  await page.waitForSelector('.hls canvas', { timeout: 30000 });
  await page.waitForSelector('.hls-load', { state: 'detached', timeout: 60000 });
  await page.waitForSelector('.hls', { state: 'detached', timeout: 60000 });          // it plays, then closes on its own
  await page.click('[data-action="watchHighlight"][data-id="hl2"]');
  await page.waitForSelector('.hls-load', { state: 'detached', timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.click('.hls-close');
  await page.waitForSelector('.hls', { state: 'detached', timeout: 5000 });
  check((await text(page)).includes('Highlight arşivi'), 'back on the archive');
  clean(page);
});

await step('a new release: the open page says so, and its button reloads into it', async () => {
  const next = mkdtempSync(join(tmpdir(), 'ms-next-'));
  cpSync(folder, next, { recursive: true });
  const sw = readFileSync(join(next, 'sw.js'), 'utf8');
  writeFileSync(join(next, 'sw.js'), sw.replace(/^const BUILD = "([^"]+)";/m, 'const BUILD = "$1next";'));
  await loadSave(page, server.url, fixture('generated/mid-season'));
  await page.waitForSelector('.bottomnav');
  check(!(await page.$('.updatenotice')), 'no notice before');
  server.setRoot(next);
  await page.evaluate(() => navigator.serviceWorker.getRegistration().then(r => r.update()));
  await page.waitForSelector('.updatenotice', { timeout: 30000 });
  check((await page.textContent('.updatenotice')).includes('Yeni sürüm hazır'), 'the notice says it');
  await Promise.all([page.waitForNavigation(), page.click('[data-action="reloadForUpdate"]')]);
  await page.waitForSelector('.bottomnav');
  check(!(await page.$('.updatenotice')), 'no notice after the reload');
  const keys = await page.evaluate(() => caches.keys());
  check(keys.length === 1 && keys[0].endsWith('next'), `only the new release's cache is left: ${keys}`);
  server.setRoot(folder);
  rmSync(next, { recursive: true, force: true });
  clean(page);
});

await step('offline: the game and the 3D match open with no network', async () => {
  await context.setOffline(true);
  page.offlineExpected = true;
  await loadSave(page, server.url, fixture('generated/mid-match'));
  await threeD(page);
  page.offlineExpected = false;
  clean(page);
  await context.setOffline(false);
});

await browser.close();
await server.close();
const failed = results.filter(r => !r.ok);
console.log(failed.length ? `smoke test: ${failed.length} of ${results.length} failed` : `smoke test: all ${results.length} passed`);
process.exit(failed.length ? 1 : 0);

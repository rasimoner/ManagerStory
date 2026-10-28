import assert from 'node:assert/strict';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { chromium } from 'playwright';
import { pagesServer } from './pages-server.mjs';

function legacyWorkerBuild(source) {
  const folder = mkdtempSync(join(tmpdir(), 'managerstory-legacy-worker-'));
  cpSync(resolve(source), folder, { recursive: true });
  const worker = readFileSync(join(folder, 'sw.js'), 'utf8');
  const definitions = worker.slice(0, worker.indexOf('/*'));
  assert.match(definitions, /const ASSETS =/);
  const legacy = readFileSync(new URL('../fixtures/service-worker/pre-laboratory.txt', import.meta.url), 'utf8');
  writeFileSync(join(folder, 'sw.js'), definitions + legacy);
  return folder;
}

const folder = legacyWorkerBuild(process.argv[2] || 'dist');
const server = await pagesServer(folder, { port: 0 });
const browser = await chromium.launch({ executablePath: process.env.SMOKE_CHROMIUM || undefined, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, serviceWorkers: 'allow' });
const problems = [];
page.on('pageerror', error => problems.push(error.message));
page.on('console', message => { if (message.type() === 'error') problems.push(message.text()); });

try {
  await page.goto(server.url);
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller) await new Promise(done => navigator.serviceWorker.addEventListener('controllerchange', done, { once: true }));
  });
  await page.goto(server.url + 'lab.html');
  await page.waitForSelector('[data-player]');
  assert.equal(await page.locator('[data-player]').count(), 22);
  assert.deepEqual(problems, []);
  console.log('ok   laboratory opens directly under the pre-laboratory game service worker');
} finally {
  await browser.close();
  await server.close();
  rmSync(folder, { recursive: true, force: true });
}

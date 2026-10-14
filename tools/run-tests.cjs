/* Run every test file with bounded parallelism, visible progress and a hard process-tree deadline. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const directory = path.resolve(process.argv[2] || 'tests');
const timeoutMs = Number(process.env.TEST_FILE_TIMEOUT_MS || 60000);
const concurrency = Number(process.env.TEST_CONCURRENCY || 2);
if (!Number.isFinite(timeoutMs) || timeoutMs <= 0 || !Number.isInteger(concurrency) || concurrency < 1) throw Error('Invalid test runner limits');
const files = fs.readdirSync(directory).filter(f => f.endsWith('.test.cjs')).sort().map(f => path.join(directory, f));
if (!files.length) throw Error('No test files found');
const active = new Map();
let next = 0, passed = 0, failed = false;
function stop(child) {
  try {
    if (process.platform === 'win32') child.kill('SIGKILL');
    else process.kill(-child.pid, 'SIGKILL');
  } catch (error) { if (error.code !== 'ESRCH') throw error; }
}
function abort(signal) {
  failed = true;
  for (const child of active.keys()) stop(child);
  process.exitCode = signal === 'SIGINT' ? 130 : 143;
}
process.on('SIGINT', () => abort('SIGINT'));
process.on('SIGTERM', () => abort('SIGTERM'));
function launch() {
  while (!failed && next < files.length && active.size < concurrency) {
    const file = files[next++], name = path.basename(file), started = Date.now();
    console.log(`[START ${next}/${files.length}] ${name}`);
    const child = spawn(process.execPath, ['--test', file], { stdio: 'inherit', detached: process.platform !== 'win32' });
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      console.error(`[TIMEOUT] ${name}: ${timeoutMs} ms; terminating test process tree`);
      stop(child);
    }, timeoutMs);
    active.set(child, timer);
    child.on('error', error => { console.error(`[ERROR] ${name}: ${error.message}`); });
    child.on('close', (code, signal) => {
      clearTimeout(timer); active.delete(child);
      const ok = code === 0 && !expired;
      console.log(`[${ok ? 'PASS' : 'FAIL'}] ${name}: ${Date.now() - started} ms${signal ? ` (${signal})` : ''}`);
      if (ok) passed++;
      else if (!failed) {
        failed = true; process.exitCode = 1;
        for (const other of active.keys()) stop(other);
      }
      if (!failed) launch();
      if (!active.size && (failed || next === files.length)) console.log(`[SUMMARY] ${passed}/${files.length} files passed; ${files.length - next} not started${failed ? '; stopped on failure' : ''}`);
    });
  }
}
launch();

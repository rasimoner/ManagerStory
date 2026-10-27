/* The lint ratchet (AGENTS.md, tools/lint/): today's violations are written down in lint-baseline.json and only
   new ones fail. The baseline may only shrink: npm run lint tightens it when a file gets cleaner, and the last
   test here compares it with the baseline on main (or, on main, with the one before the merge). */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const ratchet = () => import('../tools/lint/ratchet.js');

const message = (ruleId, line = 1) => ({ ruleId, line, message: ruleId });
const result = (file, ...messages) => ({ filePath: path.join(ROOT, file), messages });

test('violations are counted per file and rule, by the file\'s path in the repository', async () => {
  const { countViolations } = await ratchet();
  const counts = countViolations([
    result('src/a.js', message('complexity'), message('complexity', 9), message('max-depth')),
    result('src/clean.js'),
    result('tests/b.cjs', { ruleId: null, fatal: true, line: 3, message: 'Parsing error' }),
  ], ROOT);
  assert.deepEqual(counts, { 'src/a.js': { complexity: 2, 'max-depth': 1 }, 'tests/b.cjs': { 'parse-error': 1 } });
});

test('a count above the baseline, or a file or rule not in it, is new; a lower one is a reduction', async () => {
  const { compare } = await ratchet();
  const baseline = { 'src/a.js': { complexity: 2, 'max-depth': 1 }, 'src/gone.js': { 'max-params': 1 } };
  const current = { 'src/a.js': { complexity: 3 }, 'src/new.js': { 'no-unused-vars': 1 } };
  const { added, reduced } = compare(baseline, current);
  assert.deepEqual(added, [
    { file: 'src/a.js', rule: 'complexity', allowed: 2, found: 3 },
    { file: 'src/new.js', rule: 'no-unused-vars', allowed: 0, found: 1 },
  ]);
  assert.deepEqual(reduced, [
    { file: 'src/a.js', rule: 'max-depth', allowed: 1, found: 0 },
    { file: 'src/gone.js', rule: 'max-params', allowed: 1, found: 0 },
  ]);
  assert.deepEqual(compare(baseline, baseline), { added: [], reduced: [] });
});

test('tightening only lowers: it never adds a file or a rule, never raises a count, and drops what reached zero', async () => {
  const { tighten } = await ratchet();
  const baseline = { 'src/a.js': { complexity: 2, 'max-depth': 1 }, 'src/b.js': { 'max-params': 4 } };
  const current = { 'src/a.js': { complexity: 5 }, 'src/b.js': { 'max-params': 2 }, 'src/new.js': { complexity: 1 } };
  assert.deepEqual(tighten(baseline, current), { 'src/a.js': { complexity: 2 }, 'src/b.js': { 'max-params': 2 } });
});

test('the baseline is written in a stable order, so its diff shows only what changed', async () => {
  const { formatBaseline } = await ratchet();
  const text = formatBaseline({ 'src/b.js': { z: 1, a: 2 }, 'src/a.js': { complexity: 1 } });
  assert.equal(text, '{\n  "src/a.js": {\n    "complexity": 1\n  },\n  "src/b.js": {\n    "a": 2,\n    "z": 1\n  }\n}\n');
});

const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const tryGit = (...args) => { try { return git(...args); } catch { return null; } };

// the commit to compare with: where this branch left main, or on main the commit before the merge
function comparisonCommit() {
  const head = tryGit('rev-parse', 'HEAD');
  const main = tryGit('rev-parse', 'origin/main');
  if (main && main !== head) return tryGit('merge-base', 'HEAD', 'origin/main');
  return tryGit('rev-parse', 'HEAD^1');
}

test('the baseline only shrinks: nothing in it is above the baseline it started from', async t => {
  const { compare } = await ratchet();
  const base = comparisonCommit();
  const before = base && tryGit('show', `${base}:lint-baseline.json`);
  if (!before) return t.skip('no earlier baseline to compare with (first one, or no git history)');
  const now = JSON.parse(fs.readFileSync(path.join(ROOT, 'lint-baseline.json'), 'utf8'));
  assert.deepEqual(compare(JSON.parse(before), now).added, [], `lint-baseline.json grew since ${base.slice(0, 7)}`);
});

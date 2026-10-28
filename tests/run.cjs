/* The test runner behind npm test and npm run test:fast.
   npm test            every test file, as many at a time as the machine has cores (node's own default
                       leaves one core idle). The slowest files start first so the run does not end on one
                       long file.
   npm run test:fast   the quick check for each commit: everything except the long whole-match engine,
                       clock and 3D-director files, and the golden master on four fixtures (0, 11, 22, 33)
                       instead of 34. The full run is for the end of a piece of work and before main. */
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const fast = process.argv.includes('--fast');
// slowest first (measured: each 1–4 minutes); the rest take seconds
const SLOW = ['match-clock', 'matchengine-phase3', 'matchengine-phase1', 'matchengine-stress', 'newview-director', 'match-clock-fixtures', 'matchengine-phase3-restarts', 'matchengine-phase2'];
const rank = f => { const i = SLOW.indexOf(f.replace('.test.cjs', '')); return i < 0 ? SLOW.length : i; };
const performanceFile = 'match-sim-performance.test.cjs';
let files = fs.readdirSync(__dirname).filter(f => f.endsWith('.test.cjs') && f !== performanceFile).sort().sort((a, b) => rank(a) - rank(b));
if (fast) files = files.filter(f => !/^(match-clock|matchengine-|newview-director)/.test(f));

// the game is ES modules, loaded in a vm context (tests/support/game.cjs). Node 22 keeps every vm context
// that ever held a SourceTextModule alive (a few MB per loaded game), and the longest engine files load
// the game hundreds of times: they need ~3 GB of heap (the default is ~2 GB).
const env = { ...process.env, NODE_OPTIONS: [process.env.NODE_OPTIONS, '--experimental-vm-modules', '--disable-warning=ExperimentalWarning', '--max-old-space-size=6144'].filter(Boolean).join(' ') };
if (fast && !env.GOLDEN_FIXTURES) env.GOLDEN_FIXTURES = '0,11,22,33';
const workers = Math.max(2, os.availableParallelism?.() || os.cpus().length);
const result = spawnSync(process.execPath, ['--test', `--test-concurrency=${workers}`, ...files.map(f => path.join(__dirname, f))], { stdio: 'inherit', env });
if (result.status !== 0) process.exit(result.status ?? 1);
// Wall-time budgets need an idle runner, rather than competing with the whole-match stress tests.
const measured = spawnSync(process.execPath, ['--test', path.join(__dirname, performanceFile)], { stdio: 'inherit', env });
process.exit(measured.status ?? 1);

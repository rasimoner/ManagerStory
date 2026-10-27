/* npm run lint: ESLint over the repository, held to lint-baseline.json (tools/lint/ratchet.js).
   - A violation above the baseline fails, with every report of that rule in that file.
   - Fewer violations than the baseline: the baseline is tightened and written (commit it with the change).
     In CI (CI=true or --ci) nothing is written; a baseline that could be tighter fails, so the tightened file
     is always the committed one.
   - --init writes the first baseline; it refuses when one exists (the baseline never grows). */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ESLint } from 'eslint';
import { compare, countViolations, formatBaseline, tighten } from './ratchet.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BASELINE = path.join(ROOT, 'lint-baseline.json');
const inCi = process.argv.includes('--ci') || process.env.CI === 'true';
const init = process.argv.includes('--init');

function readBaseline() {
  if (!fs.existsSync(BASELINE)) throw new Error('lint-baseline.json is missing (npm run lint -- --init writes the first one).');
  return JSON.parse(fs.readFileSync(BASELINE, 'utf8'));
}

function writeFirstBaseline(counts) {
  if (fs.existsSync(BASELINE)) throw new Error('lint-baseline.json exists; the baseline only shrinks (npm run lint tightens it).');
  fs.writeFileSync(BASELINE, formatBaseline(counts));
  console.log(`lint-baseline.json written: ${Object.keys(counts).length} files.`);
}

function reportAdded(added, results) {
  console.error('New lint violations (lint-baseline.json allows fewer):');
  for (const { file, rule, allowed, found } of added) {
    console.error(`\n${file}  ${rule}: ${found} (allowed ${allowed})`);
    const result = results.find(r => path.relative(ROOT, r.filePath).split(path.sep).join('/') === file);
    for (const m of result.messages.filter(m => (m.ruleId ?? 'parse-error') === rule)) console.error(`  ${m.line}:${m.column}  ${m.message}`);
  }
  console.error('\nClean the code you touched (AGENTS.md); the baseline does not grow.');
}

function settleReductions(baseline, counts, reduced) {
  const fewer = reduced.map(({ file, rule, allowed, found }) => `  ${file}  ${rule}: ${allowed} → ${found}`).join('\n');
  if (inCi) {
    console.error(`lint-baseline.json is not tight; run npm run lint and commit the file:\n${fewer}`);
    return 1;
  }
  fs.writeFileSync(BASELINE, formatBaseline(tighten(baseline, counts)));
  console.log(`Fewer violations; lint-baseline.json tightened (commit it):\n${fewer}`);
  return 0;
}

async function main() {
  const results = await new ESLint({ cwd: ROOT }).lintFiles(['.']);
  const counts = countViolations(results, ROOT);
  if (init) {
    writeFirstBaseline(counts);
    return 0;
  }
  const baseline = readBaseline();
  const { added, reduced } = compare(baseline, counts);
  if (added.length) {
    reportAdded(added, results);
    return 1;
  }
  if (reduced.length) return settleReductions(baseline, counts, reduced);
  console.log('Lint: no new violations; lint-baseline.json is tight.');
  return 0;
}

main().then(code => { process.exitCode = code; }, error => { console.error(error.message); process.exitCode = 1; });

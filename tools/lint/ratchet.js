/* The lint ratchet: lint-baseline.json holds how many violations of each rule each file had when the rules came
   in; only more than that fails. The baseline only ever shrinks (tighten), so the code base can only get
   cleaner. Pure functions; tools/lint/lint.js runs ESLint and reads and writes the file. */
import path from 'node:path';

const PARSE_ERROR = 'parse-error';

function addOne(counts, file, rule) {
  counts[file] ??= {};
  counts[file][rule] = (counts[file][rule] ?? 0) + 1;
}

// ESLint results → { 'src/a.js': { complexity: 2 } }, paths relative to the repository, with / on every system
export function countViolations(results, root) {
  const counts = {};
  for (const { filePath, messages } of results) {
    const file = path.relative(root, filePath).split(path.sep).join('/');
    for (const { ruleId } of messages) addOne(counts, file, ruleId ?? PARSE_ERROR);
  }
  return counts;
}

function pairs(counts) {
  return Object.entries(counts).flatMap(([file, rules]) => Object.keys(rules).map(rule => [file, rule]));
}

const countOf = (counts, file, rule) => counts[file]?.[rule] ?? 0;
const byFileAndRule = (a, b) => a.file.localeCompare(b.file) || a.rule.localeCompare(b.rule);

// added: above what the baseline allows (new file or rule included); reduced: below it
export function compare(baseline, current) {
  const added = pairs(current)
    .map(([file, rule]) => ({ file, rule, allowed: countOf(baseline, file, rule), found: countOf(current, file, rule) }))
    .filter(({ allowed, found }) => found > allowed);
  const reduced = pairs(baseline)
    .map(([file, rule]) => ({ file, rule, allowed: countOf(baseline, file, rule), found: countOf(current, file, rule) }))
    .filter(({ allowed, found }) => found < allowed);
  return { added: added.sort(byFileAndRule), reduced: reduced.sort(byFileAndRule) };
}

// the baseline with every count lowered to what is found now; nothing added, nothing raised, zeros dropped
export function tighten(baseline, current) {
  const tightened = {};
  for (const [file, rule] of pairs(baseline)) {
    const count = Math.min(countOf(baseline, file, rule), countOf(current, file, rule));
    if (count > 0) (tightened[file] ??= {})[rule] = count;
  }
  return tightened;
}

function sortedKeys(object) {
  return Object.fromEntries(Object.keys(object).sort().map(key => [key, object[key]]));
}

export function formatBaseline(baseline) {
  const sorted = sortedKeys(Object.fromEntries(Object.entries(baseline).map(([file, rules]) => [file, sortedKeys(rules)])));
  return `${JSON.stringify(sorted, null, 2)}\n`;
}

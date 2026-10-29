/* Golden masters: what the game produces today, recorded once and compared exactly afterwards.
   A refactor must not change them. When a change is meant to change them, regenerate with
   UPDATE_GOLDEN=1 npm test (or the single test file) and review the diff of tests/golden/ in the commit.

   Hashes are over canonical JSON (keys sorted), so moving where a field is built does not matter,
   but any changed value, added or removed field, or reordered array does. */
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');

const DIR = path.resolve(__dirname, '../golden');
const UPDATE = process.env.UPDATE_GOLDEN === '1';

/* The game's version is written into the career and onto some screens; a release must not change a golden. */
const VERSION = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../package.json'), 'utf8')).version;
// Format 4 adds an opt-in switch. Compare the legacy payload with the unchanged format-3 goldens;
// migration and the added switch have dedicated tests, while every football/career field still hashes.
const withoutVersion = state => {
  const rest = { ...state };
  delete rest.version;
  if (rest.schemaVersion === 4 && rest.experimentalMatchEngine === false) {
    rest.schemaVersion = 3;
    delete rest.experimentalMatchEngine;
  }
  return rest;
};
const versionless = text => text.split(VERSION).join('<VERSION>')
  .replace(/<section class=card data-experimental-setting>[\s\S]*?<\/section>/, '');

function canonical(value) {
  return JSON.stringify(value, (_key, v) => {
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      return Object.keys(v).sort().reduce((o, k) => { o[k] = v[k]; return o; }, {});
    }
    return v;
  });
}
const hash = value => crypto.createHash('sha256').update(canonical(value)).digest('hex').slice(0, 24);

/* Compare a JSON record with tests/golden/<name>.json (written when UPDATE_GOLDEN=1). */
function matchJSON(name, actual) {
  const file = path.join(DIR, name + '.json');
  const text = JSON.stringify(actual, null, 1) + '\n';
  if (UPDATE || !fs.existsSync(file)) {
    if (!UPDATE) throw new Error(`golden ${name} missing: run with UPDATE_GOLDEN=1`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, text);
    return;
  }
  assert.deepEqual(actual, JSON.parse(fs.readFileSync(file, 'utf8')), `golden ${name} changed`);
}

/* Compare a text (an HTML screen) with tests/golden/<name>. GOLDEN_SCREENS=structure ignores what wires
   the page: inline event handlers (onclick="…", quoted or not) and data-* attributes (data-action and the
   values it reads), for the step that replaces one with the other (refactor C2). Everything else, text,
   tags, classes and the other attributes, must stay the same. */
const stripHandlers = html => html.replace(/\s(?:on[a-z]+|data-[a-z-]+)=(?:"[^"]*"|'[^']*'|[^\s>"']+)/g, '');
function matchText(name, actual) {
  actual = versionless(actual);
  const file = path.join(DIR, name);
  if (UPDATE) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, actual); return; }
  if (!fs.existsSync(file)) throw new Error(`golden ${name} missing: run with UPDATE_GOLDEN=1`);
  const expected = fs.readFileSync(file, 'utf8');
  if (process.env.GOLDEN_SCREENS === 'structure') assert.equal(stripHandlers(actual), stripHandlers(expected), `golden ${name} changed`);
  else assert.equal(actual, expected, `golden ${name} changed`);
}

module.exports = { canonical, hash, matchJSON, matchText, withoutVersion, versionless, UPDATE, DIR };

/* The repository's own lint rules (tools/lint/) and the rules eslint.config.js sets for AGENTS.md. */
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');

test('no-commented-out-code: code in a comment is reported, prose is not', async () => {
  const { RuleTester } = await import('eslint');
  const { default: rule } = await import('../tools/lint/no-commented-out-code.js');
  RuleTester.describe = (_name, run) => run();
  RuleTester.it = (_name, run) => run();
  RuleTester.itOnly = RuleTester.it;
  const tester = new RuleTester({ languageOptions: { ecmaVersion: 'latest', sourceType: 'module' } });
  tester.run('no-commented-out-code', rule, {
    valid: [
      '// the keeper punches a cross he cannot hold',
      '// TODO',
      '// see docs/game-rules.md (dice order)',
      '/* Randomness. Same seed, same numbers. */',
      '// e.g. a sale offer; the board answers',
      '// startMatch: M is set up',
      '#!/usr/bin/env node\nlet x = 1; x++;',
    ],
    invalid: [
      { code: '// const unused = 3;', errors: [{ messageId: 'commentedOutCode' }] },
      { code: '// render();', errors: [{ messageId: 'commentedOutCode' }] },
      { code: '// if (S.budget > 0) {\n//   sign(player);\n// }', errors: [{ messageId: 'commentedOutCode' }] },
      { code: '/*\n * save();\n * render();\n */', errors: [{ messageId: 'commentedOutCode' }] },
    ],
  });
});

async function lint(code, file) {
  const { ESLint } = await import('eslint');
  const [result] = await new ESLint({ cwd: ROOT }).lintText(code, { filePath: path.join(ROOT, file) });
  return result.messages.map(m => m.ruleId);
}

test('Math.random is reported anywhere; only the seeded generator draws', async () => {
  assert.deepEqual(await lint('export const roll = () => Math.random();\n', 'src/core/engine/example.js'), ['no-restricted-properties']);
});

test('core/ importing modes/ is reported; modes/ importing core/ is not', async () => {
  const fromCore = await lint("import { render } from '../../modes/manager/app.js';\nexport { render };\n", 'src/core/engine/example.js');
  assert.deepEqual(fromCore, ['no-restricted-imports']);
  const fromMode = await lint("import { S } from '../../core/state.js';\nexport { S };\n", 'src/modes/manager/example.js');
  assert.deepEqual(fromMode, []);
});

test('a release in a name is reported (evolveV6, v6Sign), an ordinary number is not', async () => {
  assert.deepEqual(await lint('export function evolveV6() {}\n', 'src/modes/manager/example.js'), ['id-match']);
  assert.deepEqual(await lint('export function playHalf2() {}\n', 'src/modes/manager/example.js'), []);
});

/* ESLint: the measurable part of AGENTS.md. The thresholds are close to Clean Code but set for this code base;
   today's violations are in lint-baseline.json and only new ones fail (npm run lint, tools/lint/ratchet.js).

   Thresholds (why):
   - max-lines-per-function 40: Clean Code asks for ~20 lines; 40 leaves room for a match step or a screen
     that reads top to bottom, and still flags the functions that do several things.
   - max-statements 20: much of the code puts several statements on one line, so line counts flatter it;
     statements measure how much a function does whatever its layout.
   - complexity 10: McCabe's own limit; past it a function has more paths than a reader (or a test) follows.
   - max-depth 3: one or two levels in Clean Code; a third is the last before a block wants its own function.
   - max-params 3: "three arguments should be avoided where possible"; a fourth becomes an object.
   - max-lines 400 per file: a module with one responsibility fits; past it the file usually holds two.
   - no-unused-vars, no-unreachable, local/no-commented-out-code: no dead code. no-empty (catch included):
     an error is handled or let through, never swallowed. id-match: no release in a name (evolveV6, v6Sign).
   - Math.random is banned (seeded generator only: core/random.js), and core/ does not import modes/
     (tests/structure.test.cjs also checks re-exports and import()).
   Left out on purpose: no-magic-numbers (the engine and the 3D view would report thousands of geometry and
   probability values; the rule stays in AGENTS.md and review), max-len and formatting (a separate job). */
import js from '@eslint/js';
import globals from 'globals';
import noCommentedOutCode from './tools/lint/no-commented-out-code.js';

const CLEAN_CODE = {
  'max-lines-per-function': ['error', { max: 40, skipBlankLines: true, skipComments: true, IIFEs: true }],
  'max-statements': ['error', 20],
  complexity: ['error', 10],
  'max-depth': ['error', 3],
  'max-params': ['error', 3],
  'max-lines': ['error', { max: 400, skipBlankLines: true, skipComments: true }],
  'no-unused-vars': ['error', { args: 'after-used', argsIgnorePattern: '^_', caughtErrors: 'none' }],
  'no-empty': ['error', { allowEmptyCatch: false }],
  'id-match': ['error', '^(?![A-Za-z_$]*[vV][0-9]).*$', { properties: false, onlyDeclarations: true }],
  'no-restricted-properties': ['error', { object: 'Math', property: 'random', message: 'Use the seeded generator (src/core/random.js).' }],
  'local/no-commented-out-code': 'error',
};

export default [
  { ignores: ['dist/**', 'node_modules/**', 'test-results/**', '.sites-runtime/**'] },
  js.configs.recommended,
  {
    plugins: { local: { rules: { 'no-commented-out-code': noCommentedOutCode } } },
    linterOptions: { reportUnusedDisableDirectives: 'error' },
    rules: CLEAN_CODE,
  },
  {
    files: ['src/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.browser } },
  },
  {
    files: ['src/sw.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.serviceworker } },
  },
  {
    files: ['src/core/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ regex: '(^|/)modes/', message: 'core/ does not know the modes (docs/architecture.md); say it through core/hooks.js.' }] }],
    },
  },
  {
    files: ['**/*.cjs'],
    languageOptions: { sourceType: 'commonjs', globals: { ...globals.node } },
  },
  {
    files: ['**/*.mjs', '*.js', 'tools/**/*.js'],
    languageOptions: { sourceType: 'module', globals: { ...globals.node } },
  },
  {
    // the smoke test's page.evaluate callbacks run in the page
    files: ['tests/smoke/**'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];

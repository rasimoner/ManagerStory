const test = require('node:test');
const assert = require('node:assert/strict');
const { build, offlineList } = require('./support/build.cjs');
const { gameSources } = require('./support/game.cjs');

test('the laboratory has a second built entry and its own styles, outside the offline list', () => {
  const built = build();
  const offline = offlineList(built);
  for (const file of ['lab.html', 'lab/laboratory.mjs', 'lab/laboratory.css']) {
    assert.ok(built.files.includes(file), `${file} is published`);
    assert.ok(!offline.includes(file), `${file} is online only`);
  }
  assert.match(built.read('lab.html'), /lab\/laboratory\.mjs\?build=[a-f0-9]+/);
  assert.match(built.read('lab.html'), /lab\/laboratory\.css\?build=[a-f0-9]+/);
});

test('the game imports the opt-in simulator without laboratory UI, and the laboratory loads no career or three.js', () => {
  const game = gameSources({ layers: ['clock', 'view', '3d'] });
  assert.ok(game.some(source => source.file.startsWith('core/sim/')));
  assert.ok(!game.some(source => source.file.includes('/lab/')));
  const lab = gameSources({ page: 'lab.html' });
  assert.ok(lab.some(source => source.file.startsWith('core/sim/')));
  for (const source of lab) assert.doesNotMatch(source.code, /from\s+['"]three['"]|from\s+['"][^'"]*(?:modes\/|\/state\.js|\/save\.js)|localStorage|serviceWorker\.register/);
});

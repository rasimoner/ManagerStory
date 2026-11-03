const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

test('a new match opens in the 3D view without the player asking for it', () => {
  const game = loadGame({ quiet: true });
  game.run('S=fresh();init();setExperimentalMatchEngine(true);startMatch()');
  assert.equal(game.api.M.experimental, true);
  assert.equal(game.api.M.fieldView, '3d');
});

test('a new match opens in 2D with the explanation when 3D already failed to load', () => {
  const game = loadGame({ quiet: true });
  game.api.fallbackSimulationView(new Error('Chunk download failed'));
  game.run('S=fresh();init();setExperimentalMatchEngine(true);startMatch()');
  assert.equal(game.api.M.fieldView, '2d');
  assert.match(game.html(), /3D.*2D.*devam/s);
});

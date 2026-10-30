const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');

function match() {
  const game = loadGame({ quiet: true });
  game.run('S=fresh();init();S.matchSalt=73;setExperimentalMatchEngine(true);startMatch()');
  return game;
}

test('the detached drawing contract includes physical motion, direction, goalkeeper and contact state', () => {
  const game = match(), simulation = game.api.M.simulation;
  const before = JSON.stringify(game.api.snapshotSimulation(simulation));
  const frame = game.api.captureSimulationFrame(simulation);
  const player = frame.players[0];
  assert.deepEqual({ ...player.velocity }, { x: 0, y: 0 });
  assert.equal(player.direction, simulation.teams[0].direction);
  assert.equal(player.slot, simulation.teams[0].players[0].slot);
  assert.ok(player.keeper && player.duel);
  assert.equal(frame.ball.heldBy, simulation.ball.heldBy);
  frame.players[0].keeper.mode = 'test';
  frame.ball.position.x = 999;
  assert.equal(JSON.stringify(game.api.snapshotSimulation(simulation)), before);
});

test('metres, height and heading map once to the scene, for either direction and half', () => {
  const game = match();
  assert.deepEqual({ ...game.api.simulationWorldPoint({ x: -52.5, y: 34 }, 2.44) }, { x: -52.5, y: 2.55, z: 34 });
  assert.equal(game.api.simulationWorldHeading(0), Math.PI / 2);
  assert.equal(game.api.simulationWorldHeading(Math.PI), -Math.PI / 2);
  for (const team of game.api.M.simulation.teams) {
    const player = team.players[0];
    const scene = game.api.sampleSimulationScene(game.api.M.simulationPlayback, { immediate: true });
    const drawn = scene.players.find(item => item.id === player.id);
    assert.equal(drawn.position.x, player.position.x);
    assert.equal(drawn.position.z, player.position.y);
    assert.equal(drawn.direction, team.direction);
  }
});

test('visual samples stay between observed physical frames and never advance or mutate the engine', () => {
  const game = match(), playback = game.api.M.simulationPlayback;
  game.run('advanceExperimentalPlayback(.1,{maxSteps:10})');
  const previous = playback.previousFrame, current = playback.frame;
  game.run('advanceExperimentalPlayback(.025,{maxSteps:10})');
  assert.equal(playback.previousFrame, previous, 'RAF-only draws retain the last physical frame');
  const snapshot = JSON.stringify(game.api.snapshotSimulation(game.api.M.simulation));
  const drawn = game.api.sampleSimulationScene(playback);
  assert.ok(drawn.physicsTime >= previous.physicsTime && drawn.physicsTime <= current.physicsTime);
  assert.ok(Math.abs(drawn.alpha - .25) < 1e-9);
  const player = drawn.players[5], from = previous.players[5].position, to = current.players[5].position;
  assert.ok(Math.abs(player.position.x - (from.x + (to.x - from.x) * .25)) < 1e-9);
  for (let index = 0; index < 20; index++) game.api.sampleSimulationScene(playback);
  assert.equal(JSON.stringify(game.api.snapshotSimulation(game.api.M.simulation)), snapshot);
});

test('scene membership follows the real active roster without keeping removed players', () => {
  const game = match();
  game.run('M.simulation.teams[0].players.at(-1).sentOff=true;refreshPlaybackFrame(M.simulationPlayback,M.simulation)');
  const scene = game.api.sampleSimulationScene(game.api.M.simulationPlayback, { immediate: true });
  assert.equal(scene.players.length, 21);
  assert.ok(scene.players.every(player => !player.sentOff));
});

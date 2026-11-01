const test = require('node:test');
const assert = require('node:assert/strict');
const { sceneFixture } = require('./support/simulation-scene.cjs');
const { loadGame } = require('./support/game.cjs');

async function starRecording(kind = 'sombrero') {
  const scene = await sceneFixture(), ball = new scene.THREE.Object3D(), camera = new scene.THREE.PerspectiveCamera();
  const replay = scene.api.createSimulationReplay(scene.runtime, ball, camera);
  const contacts = [{ type: 'skill', kind, time: 2, fromId: 'star', teamId: 'user', observed: false }];
  for (let tick = 0; tick <= 30; tick++) { scene.runtime.S.t = tick / 10; ball.position.x = tick / 10; replay.record({ physicsTime: tick / 10, contacts }); }
  return { scene, replay, ball, contacts };
}

test('automatic replay uses the actual star recording, waits for post-contact frames and restores the live ball', async () => {
  const { replay, ball } = await starRecording();
  assert.equal(replay.startAutomatic(2.5, true), false);
  assert.equal(replay.startAutomatic(3, false), false);
  assert.equal(replay.startAutomatic(3, true), true);
  assert.equal(replay.metadata.kind, 'sombrero');
  const live = ball.position.clone(); replay.advance(1, 390 / 844);
  assert.ok(ball.position.x < live.x); replay.stop();
  assert.ok(ball.position.distanceTo(live) < 1e-5);
  assert.equal(replay.startAutomatic(3, true), false, 'the same star cannot loop');
});

test('automatic replay has a physical-time cadence and rejects observed generic labels and expired records', async () => {
  const { replay, scene, contacts } = await starRecording();
  assert.equal(replay.startAutomatic(3, true), true); replay.stop();
  const next = [{ ...contacts[0], time: 5 }];
  for (let tick = 31; tick <= 60; tick++) { scene.runtime.S.t = tick / 10; replay.record({ physicsTime: tick / 10, contacts: next }); }
  assert.equal(replay.startAutomatic(6, true), false);
  for (let tick = 61; tick <= 350; tick++) { scene.runtime.S.t = tick / 10; replay.record({ physicsTime: tick / 10, contacts: [] }); }
  assert.equal(replay.startAutomatic(35, true), false);
  const observed = [{ ...contacts[0], time: 35, observed: true }];
  scene.runtime.S.t = 36; replay.record({ physicsTime: 36, contacts: observed });
  assert.equal(replay.startAutomatic(36, true), false);
  assert.ok(replay.count <= 180); assert.ok(replay.estimatedBytes < 8 * 1024 * 1024);
});

test('the career live clock freezes the full real checkpoint through replay and resumes with no catch-up', () => {
  const game = loadGame({ quiet: true }); game.ctx.requestAnimationFrame = () => 1; game.ctx.performance = { now: () => 0 };
  game.run('S=fresh();init();setExperimentalMatchEngine(true);startMatch();resumeLive();liveFrameStep(0)');
  const before = game.json('snapshotSimulation(M.simulation)'), tick = game.run('M.simulation.tick');
  game.run('presentation.simulation3d={replaying:true};liveFrameStep(1000);liveFrameStep(900000)');
  assert.deepEqual(game.json('snapshotSimulation(M.simulation)'), before);
  game.run('presentation.simulation3d.replaying=false;liveFrameStep(999999)');
  assert.deepEqual(game.json('snapshotSimulation(M.simulation)'), before);
  game.run('liveFrameStep(1000099)');
  assert.ok(game.run('M.simulation.tick') > tick);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const { loadGame } = require('./support/game.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');

function match() {
  const game = loadGame({ quiet: true });
  game.run('S=fresh();init();S.matchSalt=73;setExperimentalMatchEngine(true);startMatch()');
  return game;
}

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

test('the real rig draws immutable samples without invoking movement, contact or ball physics', async () => {
  const fixture = await sceneFixture(), game = match(), runtime = fixture.runtime;
  for (const name of ['move', 'stepBall', 'contacts', 'kickWarp', 'place', 'planDive', 'pickUp']) runtime[name] = () => { throw new Error(`Renderer invoked ${name}`); };
  for (let tick = 0; tick < 8; tick++) {
    game.api.advanceExperimentalPlayback(.1, { maxSteps: 1 });
    const before = game.json('snapshotSimulation(M.simulation)');
    const frame = freeze(game.api.sampleSimulationScene(game.api.M.simulationPlayback, { immediate: true }));
    fixture.actors.apply(frame);
    assert.equal(runtime.players.filter(player => !player.offPitch).length, 22);
    for (const sample of frame.players) {
      const actor = runtime.players.find(player => player.id === sample.id);
      assert.equal(actor.model.position.x, sample.position.x);
      assert.equal(actor.model.position.z, sample.position.z);
      assert.equal(actor.heading, sample.heading);
      assert.equal(actor.warp, null);
    }
    assert.equal(runtime.ball.p.y, frame.ball.position.y);
    assert.equal(runtime.ball.p.x, frame.ball.position.x);
    assert.deepEqual(game.json('snapshotSimulation(M.simulation)'), before);
  }
});

test('injury, substitution and red-card membership follows the current simulation frame', async () => {
  const fixture = await sceneFixture(), game = match();
  const apply = () => fixture.actors.apply(game.api.sampleSimulationScene(game.api.M.simulationPlayback, { immediate: true }));
  apply();
  const outgoing = game.api.M.active.at(-1), incoming = game.api.eligibleSubstitutes()[0].id;
  game.api.injureSimulationPlayer(game.api.M.simulation, { playerId: outgoing, cause: 'contact' });
  game.api.synchronizeExperimentalMatch();
  apply();
  assert.equal(fixture.runtime.players.find(player => player.id === outgoing).model.visible, false);
  game.api.queueExperimentalSubstitution({ outId: outgoing, inId: incoming });
  apply();
  assert.equal(fixture.runtime.players.find(player => player.id === incoming).model.visible, true);
  game.run('M.simulation.teams[1].players.at(-1).sentOff=true;refreshPlaybackFrame(M.simulationPlayback,M.simulation)');
  apply();
  assert.equal(fixture.runtime.players.filter(player => player.model.visible).length, 21);
});

test('both attacked goals and the actual ball/keeper fit the broadcast camera in phone portrait and landscape', async () => {
  const fixture = await sceneFixture(), game = match(), THREE = fixture.THREE;
  for (const direction of [-1, 1]) for (const aspect of [390 / 844, 390 / 500, 844 / 390]) {
    const frame = game.api.sampleSimulationScene(game.api.M.simulationPlayback, { immediate: true });
    for (const player of frame.players) player.direction = player.teamId === 'user' ? direction : -direction;
    frame.ball.position = { x: 30 * direction, y: 2, z: -12 };
    frame.ball.shot = { teamId: 'user' };
    frame.players.find(player => player.slot === 'GK' && player.teamId !== 'user').position = { x: 50 * direction, y: 0, z: 0 };
    const camera = new THREE.PerspectiveCamera(46, aspect, .1, 400), broadcast = fixture.api.createSimulationCamera(camera);
    for (let draw = 0; draw < 30; draw++) broadcast.update(frame, 1 / 60, aspect);
    camera.updateMatrixWorld(true);
    for (const point of fixture.api.simulationCameraPoints(frame)) {
      const projected = point.project(camera);
      assert.ok(Math.abs(projected.x) <= .81 && Math.abs(projected.y) <= .81 && projected.z < 1);
    }
    assert.ok(Number.isFinite(camera.fov) && camera.fov < 115);
  }
});

test('a keeper waits naturally, prepares only for the real threat and never moves his root to a save pose', async () => {
  const fixture = await sceneFixture(), game = match();
  const frame = game.api.sampleSimulationScene(game.api.M.simulationPlayback, { immediate: true });
  const keeper = frame.players.find(player => player.slot === 'GK');
  fixture.actors.apply(frame);
  const actor = fixture.runtime.players.find(player => player.id === keeper.id);
  assert.equal(actor.loopsWant.keeperReady, 0);
  keeper.keeper = { mode: 'dive', target: { y: 2 }, reactionAt: 0 };
  frame.physicsTime = .2;
  fixture.actors.apply(frame);
  assert.equal(actor.loopsWant.keeperReady, 1);
  assert.equal(actor.model.position.x, keeper.position.x);
  assert.equal(actor.model.position.z, keeper.position.z);
  assert.equal(actor.dive, null);
  keeper.keeper.mode = 'positioning';
  frame.physicsTime = 1;
  fixture.actors.apply(frame);
  assert.equal(actor.loopsWant.keeperReady, 0);
});

test('keeper arms reach towards the actual threat after either team changes ends', async () => {
  const game = match();
  for (const heading of [Math.PI / 2, -Math.PI / 2]) {
    const fixture = await sceneFixture();
    const frame = game.api.sampleSimulationScene(game.api.M.simulationPlayback, { immediate: true });
    const keeper = frame.players.find(player => player.slot === 'GK');
    keeper.heading = heading;
    keeper.keeper = { mode: 'dive', target: { x: keeper.position.x, y: keeper.position.z + 2 }, reactionAt: 0 };
    frame.physicsTime = .4;
    fixture.actors.apply(frame);
    const actor = fixture.runtime.players.find(player => player.id === keeper.id);
    const hands = actor.bones.LeftHand.getWorldPosition(new fixture.THREE.Vector3())
      .add(actor.bones.RightHand.getWorldPosition(new fixture.THREE.Vector3())).multiplyScalar(.5);
    assert.ok(hands.z > keeper.position.z, `heading ${heading}: hands must reach towards +pitch-y`);
  }
});

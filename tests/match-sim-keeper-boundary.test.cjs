const test = require('node:test');
const assert = require('node:assert/strict');
const { keeperScenario, recordKeeperScenario, KEEPER_SCENARIOS, ordinaryKeeperCareer } = require('./support/keeper-recordings.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');
const { keeperScene } = require('./support/keeper-scene.cjs');
const { loadGame } = require('./support/game.cjs');

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

test('actual catch, parry and missed shots draw without changing a single engine, event or RNG field', async () => {
  for (const options of KEEPER_SCENARIOS.slice(0, 4)) {
    const fixture = keeperScenario(options), scene = await sceneFixture();
    for (const name of ['move', 'stepBall', 'contacts', 'kickWarp', 'place', 'planDive', 'pickUp', 'updateDive', 'riseFromFront', 'updateProne']) {
      scene.runtime[name] = () => { throw new Error(`Legacy solver called: ${name}`); };
    }
    for (let tick = 0; tick < 35; tick++) {
      fixture.api.stepSimulation(fixture.simulation);
      const before = JSON.stringify(fixture.api.snapshotSimulation(fixture.simulation));
      const frame = fixture.api.captureSimulationFrame(fixture.simulation);
      scene.actors.apply(freeze(fixture.api.sampleSimulationScene({ frame }, { immediate: true })));
      assert.equal(JSON.stringify(fixture.api.snapshotSimulation(fixture.simulation)), before);
    }
    const result = fixture.simulation.events.find(event => event.type === 'save' || event.type === 'goal');
    assert.equal(result?.kind ?? 'miss', options.label.split('-')[0]);
  }
});

test('presentation copies observed saves independently and rebuilds them after saving a real career', () => {
  const career = ordinaryKeeperCareer(), frame = career.frames.find(item => item.players.some(player => player.keeper.lastSave));
  assert.ok(frame);
  const restored = loadGame({ storage: new Map([['msv4', career.duringSaveStorage]]), quiet: true });
  const saved = restored.api.unpackMatchSnapshot(JSON.parse(career.duringSaveStorage).activeMatchV71);
  assert.equal(JSON.stringify(restored.api.snapshotSimulation(restored.api.M.simulation)), JSON.stringify(saved.simulationCheckpoint));
  const fixture = keeperScenario(KEEPER_SCENARIOS[0]);
  for (let tick = 0; tick < 12; tick++) fixture.api.stepSimulation(fixture.simulation);
  const keeper = fixture.simulation.teams[1].players[0];
  const before = JSON.stringify(fixture.api.snapshotSimulation(fixture.simulation));
  keeper.keeper.reactionAt = 1.4;
  const snapshot = JSON.stringify(fixture.api.snapshotSimulation(fixture.simulation));
  const drawing = fixture.api.captureSimulationFrame(fixture.simulation), copy = drawing.players.find(player => player.id === keeper.id);
  assert.ok(copy.keeperPresentation.previousSave);
  copy.keeperPresentation.previousSave.toPos.y = 999;
  assert.equal(JSON.stringify(fixture.api.snapshotSimulation(fixture.simulation)), snapshot);
  assert.notEqual(snapshot, before, 'only the test fixture explicitly arms another reaction');
});

test('a shot already stopped before reaction does not create a late phantom dive', async () => {
  const scene = await keeperScene();
  scene.sample.keeperPresentation = { stoppedAt: .95 };
  scene.sample.keeper.mode = 'positioning';
  scene.draw(1.4);
  const axis = scene.bone('Head').sub(scene.bone('Hips')).normalize();
  assert.ok(axis.y > .8);
});

test('a keeper who stepped towards the first save is still grounded when a rebound shot is armed', async () => {
  const fixture = keeperScenario({ ...KEEPER_SCENARIOS[1], power: 18 }), scene = await sceneFixture();
  for (let tick = 0; tick < 10; tick++) fixture.api.stepSimulation(fixture.simulation);
  const draw = () => scene.actors.apply(fixture.api.sampleSimulationScene({ frame: fixture.api.captureSimulationFrame(fixture.simulation) }, { immediate: true }));
  draw();
  const actor = scene.runtime.players.find(player => player.id === fixture.keeperId);
  const before = Object.fromEntries(Object.entries(actor.bones).map(([name, bone]) => [name, bone.getWorldPosition(new scene.THREE.Vector3())]));
  const shooter = fixture.simulation.teams[0].players.at(-1);
  const option = fixture.api.evaluateSimulationShot(fixture.simulation, shooter);
  fixture.api.releaseSimulationShot(fixture.simulation, shooter, { ...option, target: { x: 52.5, y: 2.7, height: .4 } });
  draw();
  const largest = Math.max(...Object.entries(actor.bones).map(([name, bone]) => bone.getWorldPosition(new scene.THREE.Vector3()).distanceTo(before[name])));
  assert.ok(largest < .13, `a close contact does not erase the earlier full-body dive (${largest})`);
});

test('landing and support remain continuous and above the turf for both sides and high balls', async () => {
  for (const [side, height] of [[-1, .3], [-1, 2.3], [1, .3], [1, 2.3]]) await verifyGroundedChain(side, height);
});

async function verifyGroundedChain(side, height) {
  const scene = await keeperScene({ keeper: { target: { x: 52.61, y: 2.6 * side, height } } });
  let previous, maximum = 0, minimum = Infinity;
  for (let tick = 0; tick < 300; tick++) {
    const actor = scene.draw(.9 + tick / 120), points = scene.points();
    for (const [name, point] of Object.entries(points)) {
      minimum = Math.min(minimum, point.y);
      if (previous) maximum = Math.max(maximum, point.distanceTo(previous[name]));
    }
    const chestUp = new scene.THREE.Vector3(0, 0, 1).applyQuaternion(actor.bones.Spine2.getWorldQuaternion(new scene.THREE.Quaternion())).y;
    assert.ok(chestUp < .65, 'recovery never rolls onto the back or upside down');
    previous = points;
  }
  assert.ok(minimum > -.025);
  assert.ok(maximum < .13, `continuous side ${side} / height ${height}: ${maximum}`);
}

test('real observed flight and recovery stay continuous while heading, velocity and keeper mode change', async () => {
  for (const options of KEEPER_SCENARIOS.slice(0, 4)) await verifyRecordedChain(options);
});

async function verifyRecordedChain(options) {
  const recording = recordKeeperScenario(options), scene = await sceneFixture();
  const api = loadGame({ skip: ['main.js'], quiet: true }).api;
  let previous, largest = 0;
  for (let index = 0; index <= 360; index++) {
    const time = index / 120, current = Math.min(recording.frames.length - 1, Math.ceil(time * 10));
    const before = recording.frames[Math.max(0, current - 1)];
    const frame = api.sampleSimulationScene({ frame: recording.frames[current], previousFrame: before, accumulatorSeconds: time - before.physicsTime });
    frame.players = frame.players.filter(player => player.id === recording.keeperId);
    scene.actors.apply(frame);
    const root = new scene.THREE.Vector3().copy(frame.players[0].position);
    const actor = scene.runtime.players[0], points = Object.fromEntries(Object.entries(actor.bones)
      .map(([name, bone]) => [name, bone.getWorldPosition(new scene.THREE.Vector3()).sub(root)]));
    if (previous) for (const name of Object.keys(points)) largest = Math.max(largest, points[name].distanceTo(previous[name]));
    previous = points;
  }
  assert.ok(largest < .13, `${options.label}: world-space body discontinuity excluding the actual engine translation ${largest}`);
}

const test = require('node:test');
const assert = require('node:assert/strict');
const { sceneFixture } = require('./support/simulation-scene.cjs');
const { loadGame } = require('./support/game.cjs');

function scene() {
  const player = { id: 1, number: 9, teamId: 'user', direction: 1, slot: 'ST', motionMode: 'run', distanceMetres: 0,
    position: { x: 30, y: 0, z: 0 }, velocity: { x: 4, y: 0, z: 0 }, heading: Math.PI / 2, keeper: {}, duel: {} };
  return { players: [player], physicsTime: 0, matchTime: 0, half: 1, phase: 'playing', contacts: [],
    ball: { position: { x: 30.65, y: .11, z: 0 }, velocity: { x: 4, y: 0, z: 0 }, ownerId: 1, heldBy: null } };
}

function gameMatch() {
  const game = loadGame({ quiet: true });
  game.run('S=fresh();init();setExperimentalMatchEngine(true);startMatch()');
  return game;
}

test('the detached contract preserves first-touch height, participants, carry touch and restart semantics', () => {
  const game = gameMatch(), sim = game.api.M.simulation;
  const event = { type: 'firstTouch', time: .04, fromId: 1, toId: 2, height: 1.1, success: true,
    fromPos: { x: 12, y: 2 }, toPos: { x: 13, y: 2 } };
  sim.events.push(event);
  sim.ball.carry = { playerId: 1, touchTick: 4 };
  sim.ball.restart = { kind: 'corner', takerId: 1, position: { x: 52.5, y: 34 } };
  const before = JSON.stringify(game.api.snapshotSimulation(sim));
  const frame = game.api.captureSimulationFrame(sim), contact = frame.contacts.find(item => item.type === 'firstTouch');
  assert.equal(contact.toId, 2);
  assert.equal(contact.height, 1.1);
  assert.equal(frame.ball.carry.touchTick, 4);
  assert.equal(frame.ball.restart.kind, 'corner');
  contact.fromPos.x = 999;
  assert.equal(JSON.stringify(game.api.snapshotSimulation(sim)), before);
});

test('automatic tackle close-ups keep the old final-third, alternate-challenge gate', async () => {
  const { api } = await sceneFixture(), game = gameMatch(), sim = game.api.M.simulation;
  const frame = scene(), defender = { ...structuredClone(frame.players[0]), id: 2, teamId: 'opponent' };
  frame.players.push(defender);
  for (let index = 0; index < 3; index++) sim.events.push({ type: 'tackle', time: index * .2, fromId: 2, toId: 1,
    fromPos: { x: 30, y: 1 }, toPos: { x: 30, y: 0 }, kind: 'standing', success: false });
  sim.time = sim.physicsTime = .5;
  frame.contacts = game.api.captureSimulationFrame(sim).contacts;
  assert.deepEqual(Array.from(frame.contacts.filter(item => item.type === 'tackle'), item => item.closeUp), [true, false, true]);
  frame.physicsTime = .1;
  assert.equal(api.simulationCameraShot(frame, 'auto').mode, 'close');
  frame.physicsTime = .3;
  assert.equal(api.simulationCameraShot(frame, 'auto').mode, 'tv');
  frame.physicsTime = .45;
  assert.equal(api.simulationCameraShot(frame, 'auto').mode, 'close');
  frame.contacts = [];
  assert.equal(api.simulationCameraShot(frame, 'auto').mode, 'tv', 'ordinary ball control does not zoom');
});

test('manual camera switches ease from the current composition without resetting the gantry', async () => {
  const { api, THREE } = await sceneFixture(), frame = scene();
  const camera = new THREE.PerspectiveCamera(), director = api.createSimulationCamera(camera);
  director.update(frame, 0, { mode: 'tv', aspect: 844 / 390 });
  const from = camera.position.clone();
  director.update(frame, 1 / 60, { mode: 'close', aspect: 844 / 390 });
  assert.ok(camera.position.distanceTo(from) < 2, 'a mode change starts a smooth transition');
});

test('the ball rolls by observed distance, spins in flight and freezes when paused or held', async () => {
  const { api, THREE } = await sceneFixture(), frame = scene();
  const mesh = new THREE.Object3D(), shadow = new THREE.Mesh(new THREE.CircleGeometry(), new THREE.MeshBasicMaterial());
  const view = api.createSimulationBallView(mesh, shadow);
  view.apply(frame);
  const original = mesh.quaternion.clone();
  advanceBall(view, frame, { time: .1, distance: .11 });
  assert.ok(Math.abs(original.angleTo(mesh.quaternion) - 1) < 1e-8);
  const rolled = mesh.quaternion.clone();
  view.apply(frame);
  assert.equal(mesh.quaternion.angleTo(rolled), 0);
  advanceBall(view, frame, { time: .2, distance: .11, height: 2 });
  assert.ok(mesh.quaternion.angleTo(rolled) > .9);
  const airborne = mesh.quaternion.clone();
  advanceBall(view, frame, { time: .3, distance: 1, heldBy: 1 });
  assert.equal(mesh.quaternion.angleTo(airborne), 0);
  assert.equal(mesh.position.y, 2);
  assert.ok(shadow.material.opacity < .45);
});

test('first touch follows the observed airborne contact before descending to the current engine position', () => {
  const game = gameMatch(), playback = game.api.M.simulationPlayback;
  const previous = structuredClone(playback.frame), current = structuredClone(previous);
  previous.physicsTime = 0; current.physicsTime = .1;
  previous.ball.position = { x: 0, y: 0 }; previous.ball.height = 1.2;
  current.ball.position = { x: 1, y: 0 }; current.ball.height = 0;
  current.contacts = [{ type: 'firstTouch', time: .08, toId: 1, height: 1.05, fromPos: { x: .8, y: 0 }, success: true }];
  const view = { previousFrame: previous, frame: current, accumulatorSeconds: .05 };
  const sample = game.api.sampleSimulationScene(view);
  assert.ok(sample.ball.position.y > 1.1, 'the receiver must not pull an incoming ball to the grass before contact');
  view.accumulatorSeconds = .1;
  assert.equal(game.api.sampleSimulationScene(view).ball.position.y, .11);
});

test('keeper gloves enclose the held mesh in both directions and release on a real distribution', async () => {
  for (const direction of [-1, 1]) {
    const fixture = await sceneFixture(), frame = scene(), keeper = frame.players[0];
    keeper.slot = 'GK'; keeper.direction = direction; keeper.heading = direction * Math.PI / 2;
    keeper.keeper = { mode: 'holding' }; keeper.velocity = { x: 0, y: 0, z: 0 };
    frame.ball.heldBy = keeper.id;
    frame.ball.position = { x: keeper.position.x, y: 1.11, z: 0 };
    fixture.actors.apply(frame);
    const actor = fixture.runtime.players[0];
    const hands = ['Left', 'Right'].map(side => actor.bones[`${side}Hand`].getWorldPosition(new fixture.THREE.Vector3())),
      grip = hands[0].clone().add(hands[1]).multiplyScalar(.5);
    for (const hand of hands) assert.ok(hand.distanceTo(grip) < .18, 'each glove stays around the held mesh');
    assert.equal(fixture.runtime.ball.p.y, frame.ball.position.y);
    frame.physicsTime = .2; frame.ball.heldBy = null;
    frame.contacts = [{ type: 'keeperDistribution', time: .1, fromId: keeper.id, kind: 'punt' }];
    fixture.actors.apply(frame);
    assert.equal(actor.act?.name, 'gkVolley');
    assert.equal(fixture.runtime.ball.held ?? null, null);
  }
});

test('real airborne control uses the old chest pose; a generic dribble never invents a named skill', async () => {
  const fixture = await sceneFixture(), frame = scene();
  frame.physicsTime = .5;
  frame.contacts = [{ type: 'firstTouch', time: .4, toId: 1, fromId: 2, height: 1.2, success: true }];
  fixture.actors.apply(frame);
  assert.equal(fixture.runtime.players[0].act?.name, 'chest');
  frame.physicsTime = 2; frame.contacts = [{ type: 'dribble', time: 1.9, fromId: 1 }];
  fixture.actors.apply(frame);
  assert.equal(fixture.runtime.players[0].act, null);
});

test('turning boots stay continuous through 90 and 180 degrees and repeated paused draws', async () => {
  const fixture = await sceneFixture(), frame = scene();
  let previous = null, worst = 0;
  for (let index = 0; index <= 120; index++) {
    const angle = index / 120 * Math.PI, player = frame.players[0];
    frame.physicsTime = index / 60;
    player.position = { x: 30 + Math.sin(angle), y: 0, z: 1 - Math.cos(angle) };
    player.heading = Math.PI / 2 - angle;
    player.velocity = { x: Math.cos(angle) * Math.PI / 2, y: 0, z: Math.sin(angle) * Math.PI / 2 };
    fixture.actors.apply(frame);
    const actor = fixture.runtime.players[0], toe = side => actor.bones[`${side}ToeBase`].getWorldPosition(new fixture.THREE.Vector3());
    const points = ['Left', 'Right'].map(toe);
    if (previous) worst = Math.max(worst, ...points.map((point, side) => point.distanceTo(previous[side])));
    previous = points;
    fixture.actors.apply(frame);
    for (const [side, point] of points.entries()) assert.ok(point.distanceTo(toe(['Left', 'Right'][side])) < 1e-5, 'paused pose must be idempotent');
  }
  assert.ok(worst < .15, `turning foot jump at 60 Hz: ${worst}`);
});

test('second-half preparation is masked until the real kickoff without advancing another simulation', () => {
  const game = gameMatch(), frame = game.api.M.simulationPlayback.frame;
  frame.phase = 'half'; frame.half = 2; frame.matchTime = 2780;
  const before = JSON.stringify(game.api.snapshotSimulation(game.api.M.simulation));
  assert.equal(game.api.simulationSceneStatus(frame).preparing, true);
  assert.equal(game.api.simulationDisplayMatchTime(frame), 2700);
  frame.phase = 'playing';
  assert.equal(game.api.simulationSceneStatus(frame).preparing, false);
  assert.equal(game.api.simulationDisplayMatchTime(frame), 2780);
  frame.phase = 'ended'; frame.matchTime = 5400;
  assert.equal(game.api.simulationDisplayMatchTime(frame), 5400);
  assert.equal(JSON.stringify(game.api.snapshotSimulation(game.api.M.simulation)), before);
});

test('a real carry touch meets a stable boot without moving the engine ball or inventing a skill', async () => {
  const fixture = await sceneFixture(), frame = scene();
  frame.players[0].motionMode = 'dribble';
  frame.ball.carry = { playerId: 1, touchTick: 2 };
  frame.physicsTime = .2;
  fixture.actors.apply(frame);
  const actor = fixture.runtime.players[0], toe = side => actor.bones[`${side}ToeBase`].getWorldPosition(new fixture.THREE.Vector3());
  const closest = Math.min(...['Left', 'Right'].map(side => toe(side).distanceTo(fixture.runtime.ball.p)));
  assert.ok(closest < .26, `the observed carry touch should meet a boot (${closest})`);
  assert.equal(fixture.runtime.ball.p.x, frame.ball.position.x);
  assert.equal(actor.act, null);
});

function advanceBall(view, frame, input) {
  frame.physicsTime = input.time;
  frame.ball.position.x += input.distance;
  if (input.height != null) frame.ball.position.y = input.height;
  if (input.heldBy != null) frame.ball.heldBy = input.heldBy;
  view.apply(frame);
}

test('shielding uses the existing body-protection pose only while the engine selects shield', async () => {
  const fixture = await sceneFixture(), frame = scene();
  frame.players[0].motionMode = 'shield';
  fixture.actors.apply(frame);
  assert.equal(fixture.runtime.players[0].act?.name, 'shoulder');
  frame.physicsTime = .2; frame.players[0].motionMode = 'run';
  fixture.actors.apply(frame);
  assert.equal(fixture.runtime.players[0].act, null);
});

test('an observed goal remains visible at double speed even when many contacts follow it', async () => {
  const game = gameMatch(), sim = game.api.M.simulation, { api } = await sceneFixture();
  sim.events.push({ type: 'goal', time: 1, fromId: 1, teamId: 'user' });
  for (let index = 0; index < 60; index++) sim.events.push({ type: 'duel', time: 1.1 + index / 100, fromId: 2, toId: 3, kind: 'shoulder' });
  sim.time = sim.physicsTime = 2;
  const frame = scene(); frame.physicsTime = 2; frame.contacts = game.api.captureSimulationFrame(sim).contacts;
  assert.equal(api.observedSimulationGoal(frame)?.fromId, 1, 'contact volume must not truncate the goal/photo window');
});

test('a real shoulder duel uses the existing contact pose for both actual participants', async () => {
  const fixture = await sceneFixture(), frame = scene();
  frame.players.push({ ...structuredClone(frame.players[0]), id: 2, teamId: 'opponent' });
  frame.contacts = [{ type: 'duel', kind: 'shoulder', fromId: 1, toId: 2, time: 0, success: true }];
  frame.physicsTime = .2;
  fixture.actors.apply(frame);
  for (const actor of fixture.runtime.players) assert.equal(actor.act?.name, 'shoulder');
});

test('a caught ball is visibly gripped during grounded recovery and leaves the hands continuously', async () => {
  const fixture = await sceneFixture(), frame = scene();
  const { actor, mesh, view } = heldSceneFixture(fixture, frame);
  actor.bones.Hips.position.y -= .6; actor.model.updateMatrixWorld(true);
  const grip = actor.bones.LeftHand.getWorldPosition(new fixture.THREE.Vector3())
    .add(actor.bones.RightHand.getWorldPosition(new fixture.THREE.Vector3())).multiplyScalar(.5);
  view.apply(frame);
  assert.ok(mesh.position.distanceTo(grip) < .02, 'the visible held ball must meet the actual gloves even while the body is low');
  assert.equal(fixture.runtime.ball.p.y, 1.21, 'the detached metric source remains untouched');
  frame.ball.heldBy = null; frame.physicsTime = .1; frame.ball.position.x += .5;
  view.apply(frame);
  assert.ok(mesh.position.distanceTo(grip) < .02, 'release begins at the visible grip');
  frame.physicsTime = .4; frame.ball.position.x++;
  view.apply(frame);
  assert.ok(mesh.position.distanceTo(new fixture.THREE.Vector3().copy(frame.ball.position)) < 1e-8);
});

function heldSceneFixture(fixture, frame) {
  const keeper = frame.players[0];
  Object.assign(keeper, { slot: 'GK', keeper: { mode: 'holding' }, velocity: { x: 0, y: 0, z: 0 } });
  Object.assign(frame.ball, { heldBy: keeper.id, position: { x: 30, y: 1.21, z: 0 } });
  fixture.actors.apply(frame);
  const mesh = new fixture.THREE.Object3D();
  const shadow = new fixture.THREE.Mesh(new fixture.THREE.CircleGeometry(), new fixture.THREE.MeshBasicMaterial());
  const view = fixture.api.createSimulationBallView(mesh, shadow, { runtime: fixture.runtime });
  return { actor: fixture.runtime.players[0], mesh, view };
}

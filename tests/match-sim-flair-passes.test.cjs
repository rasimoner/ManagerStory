const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');
const { loadGame } = require('./support/game.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');

function passFixture(kind, direction = 1) {
  const { api, input } = labFixture({ seed: 73 });
  input.match = false; input.durationSeconds = 420;
  input.teams.forEach((team, index) => { team.direction = index ? -direction : direction; });
  const simulation = api.createSimulation(input), owner = simulation.teams[0].players.at(-1), receiver = simulation.teams[0].players.find(player => player.slot === 'CAM');
  for (const team of simulation.teams) for (const player of team.players) { player.position = { x: -40 * direction, y: 25 }; player.target = { ...player.position }; }
  owner.position = { x: 20 * direction, y: 0 }; owner.heading = (direction < 0 ? Math.PI : 0) + (kind === 'backheel' ? Math.PI : 0);
  receiver.position = { x: (kind === 'backheel' ? 31 : 40) * direction, y: 3 };
  Object.assign(owner.attributes, { passing: 95, technique: 95, firstTouch: 95, vision: 95 });
  api.placeSimulationBall(simulation, { teamId: owner.teamId, ownerId: owner.id, position: { x: owner.position.x + Math.cos(owner.heading) * .35, y: owner.position.y + Math.sin(owner.heading) * .35 } });
  api.requestSimulationPass(simulation, { toId: receiver.id, lofted: kind === 'rabona', target: { ...receiver.position } });
  return { api, simulation, owner, receiver, kind };
}

function untilPass(fixture) {
  const { api, simulation } = fixture;
  for (let tick = 0; tick < 90 && !simulation.events.some(event => event.type === 'pass'); tick++) api.stepSimulation(simulation);
  const pass = simulation.events.find(event => event.type === 'pass');
  assert.ok(pass, 'a special pass must release through the live owner path');
  return pass;
}

for (const kind of ['backheel', 'rabona']) for (const direction of [-1, 1]) {
  test(`${kind} is physically prepared in live play, direction ${direction}`, () => {
    const fixture = passFixture(kind, direction), { api, simulation, owner } = fixture;
    const pass = untilPass(fixture);
    assert.equal(pass.style, kind); assert.equal(pass.success, null);
    assert.ok(Math.hypot(owner.position.x - pass.fromPos.x, owner.position.y - pass.fromPos.y) < 1.2);
    if (kind === 'backheel') {
      const aim = { x: pass.toPos.x - pass.fromPos.x, y: pass.toPos.y - pass.fromPos.y };
      assert.ok(aim.x * Math.cos(owner.heading) + aim.y * Math.sin(owner.heading) < 0, 'the pass goes behind the actual body facing');
    }
    const restored = api.restoreSimulation(JSON.parse(JSON.stringify(api.snapshotSimulation(simulation))));
    for (let tick = 0; tick < 30; tick++) { api.stepSimulation(simulation); api.stepSimulation(restored); }
    assert.deepEqual(plain(api.readSimulation(restored)), plain(api.readSimulation(simulation)));
  });
}

test('weak technique retains an ordinary pass rather than receiving a special label', () => {
  for (const kind of ['backheel', 'rabona']) {
    const fixture = passFixture(kind); fixture.owner.attributes.technique = 25;
    assert.notEqual(untilPass(fixture).style, kind);
  }
});

test('a mid-setup JSON save resumes the same stance, release, physical flight and RNG', () => {
  const fixture = passFixture('rabona'), { api, simulation } = fixture;
  for (let tick = 0; tick < 4; tick++) api.stepSimulation(simulation);
  assert.ok(simulation.passing.technique, 'the stance is a core intent rather than a renderer-only label');
  const restored = api.restoreSimulation(JSON.parse(JSON.stringify(api.snapshotSimulation(simulation))));
  untilPass(fixture); untilPass({ api, simulation: restored });
  assert.deepEqual(plain(api.readSimulation(restored)), plain(api.readSimulation(simulation)));
});

for (const kind of ['backheel', 'rabona']) {
  test(`the old ${kind} boot path actually meets the physical ball without moving the root`, async () => {
    const fixture = passFixture(kind), { api, simulation, owner } = fixture, scene = await sceneFixture(), game = loadGame({ quiet: true });
    const pass = untilPass(fixture), before = plain(api.snapshotSimulation(simulation));
    const frame = game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(simulation) }, { immediate: true });
    scene.actors.apply(frame);
    const actor = scene.runtime.players.find(actor => actor.id === owner.id), ball = new scene.THREE.Vector3().copy(frame.ball.position);
    const bone = kind === 'backheel' ? 'RightFoot' : 'RightToeBase';
    const gap = actor.bones[bone].getWorldPosition(new scene.THREE.Vector3()).distanceTo(ball);
    assert.ok(gap < .3, `${kind} actual foot contact (${gap})`);
    assert.equal(actor.pos.x, owner.position.x); assert.equal(actor.pos.z, owner.position.y);
    assert.ok(pass.technique);
    assert.deepEqual(plain(api.snapshotSimulation(simulation)), before);
  });
}

module.exports = { passFixture, untilPass };

test('a rabona stance outside the pitch falls back to the ordinary live pass', () => {
  const { api, simulation, owner, receiver } = passFixture('rabona');
  owner.position = { x: 20, y: 33.95 }; owner.heading = 0; receiver.position = { x: 40, y: 33.95 };
  api.placeSimulationBall(simulation, { teamId: owner.teamId, ownerId: owner.id, position: { x: 20.35, y: 33.95 } });
  api.requestSimulationPass(simulation, { toId: receiver.id, lofted: true, target: receiver.position });
  api.stepSimulation(simulation);
  assert.notEqual(simulation.passing.technique?.kind, 'rabona');
});

test('the rabona kicking boot travels behind the actual supporting leg before crossing to the ball', async () => {
  const { api, simulation, owner } = passFixture('rabona'), game = loadGame({ quiet: true }), scene = await sceneFixture();
  for (let tick = 0; tick < 40 && simulation.passing.technique?.readyAt == null; tick++) api.stepSimulation(simulation);
  const technique = simulation.passing.technique;
  assert.ok(technique?.readyAt != null);
  let behind = false, crossed = false;
  for (let tick = 0; tick < 5; tick++) {
    api.stepSimulation(simulation);
    const frame = game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(simulation) }, { immediate: true });
    scene.actors.apply(frame);
    const actor = scene.runtime.players.find(actor => actor.id === owner.id), forward = new scene.THREE.Vector3(Math.cos(technique.heading), 0, Math.sin(technique.heading));
    const left = actor.bones.LeftToeBase.getWorldPosition(new scene.THREE.Vector3()), right = actor.bones.RightToeBase.getWorldPosition(new scene.THREE.Vector3());
    const delta = right.sub(left), side = new scene.THREE.Vector3(-forward.z, 0, forward.x);
    behind ||= delta.dot(forward) < -.1;
    crossed ||= delta.dot(side) < -.03;
  }
  assert.ok(behind && crossed, 'rabona is an actual wrap behind the standing leg');
});

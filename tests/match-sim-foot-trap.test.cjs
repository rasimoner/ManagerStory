const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');
const { loadGame } = require('./support/game.cjs');

function trapFixture(direction = 1, technique = 100) {
  const { api, simulation } = labFixture({ seed: 731 });
  simulation.match.enabled = false; simulation.time = simulation.physicsTime = .1; simulation.tick = 1;
  const player = simulation.teams[0].players.at(-1);
  for (const team of simulation.teams) for (const p of team.players) { p.position = { x: -35, y: 25 }; p.target = { ...p.position }; }
  player.position = { x: 0, y: 0 }; player.velocity = { x: 0, y: 0 }; player.heading = direction < 0 ? Math.PI : 0;
  player.attributes.firstTouch = 100; player.attributes.technique = technique;
  const before = { position: { x: .3 * direction, y: 0 }, velocity: { x: direction, y: 0 }, height: .7, verticalVelocity: -.8 };
  const after = api.predictSimulationBall(before, .1);
  Object.assign(simulation.ball, after, { ownerId: null, carry: null, flight: null });
  api.controlSimulationBall(simulation, { player, previous: player.position, fraction: 1 }, { before, after });
  return { api, simulation, player, after, direction };
}

for (const direction of [-1, 1]) test(`special foot trap cushions the actual falling ball with a lifted boot, direction ${direction}`, async () => {
  const { api, simulation, player, after } = trapFixture(direction), scene = await sceneFixture(), game = loadGame({ quiet: true });
  const contact = simulation.events.find(e => e.type === 'firstTouch');
  assert.equal(contact.style, 'trap'); assert.equal(contact.kind, 'foot');
  assert.equal(simulation.ball.height, after.height);
  assert.ok(Math.abs(simulation.ball.verticalVelocity) < Math.abs(after.verticalVelocity));
  const before = plain(api.snapshotSimulation(simulation));
  const frame = game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(simulation) }, { immediate: true }); scene.actors.apply(frame);
  const actor = scene.runtime.players.find(p => p.id === player.id), ball = new scene.THREE.Vector3().copy(frame.ball.position);
  const boot = actor.bones.RightToeBase.getWorldPosition(new scene.THREE.Vector3());
  assert.ok(boot.y > .3 && boot.distanceTo(ball) < .3, `raised trap boot contact (${boot.distanceTo(ball)})`);
  assert.equal(actor.pos.x, player.position.x); assert.equal(actor.pos.z, player.position.y);
  assert.deepEqual(plain(api.snapshotSimulation(simulation)), before);
  const restored = api.restoreSimulation(JSON.parse(JSON.stringify(before)));
  for (let tick = 0; tick < 30; tick++) { api.stepSimulation(simulation); api.stepSimulation(restored); }
  assert.deepEqual(plain(api.readSimulation(simulation)), plain(api.readSimulation(restored)));
});

test('ordinary low-ability foot control is not renamed a special trap', () => {
  const { simulation } = trapFixture(1, 20);
  assert.notEqual(simulation.events.find(e => e.type === 'firstTouch').style, 'trap');
});

test('a trap intent waits for real shin height instead of first claiming the dropping pass with the head', () => {
  const { api, simulation, player } = trapFixture();
  const before = { position: { x: .35, y: 0 }, velocity: { x: .15, y: 0 }, height: 1.4, verticalVelocity: -1 };
  const after = api.predictSimulationBall(before, .1);
  Object.assign(simulation.ball, after, { ownerId: null, control: null, flight: { teamId: player.teamId, toId: player.id, cross: false } });
  api.captureSimulationPlayerPositions(simulation);
  assert.equal(api.earliestSimulationBallContact(simulation, { before, after, seconds: .1, startTime: 0 }), null);
});

test('the live receiver raises the trap boot before the dropping pass actually contacts it', async () => {
  const { api, simulation, player } = trapFixture(), scene = await sceneFixture(), game = loadGame({ quiet: true });
  simulation.time = simulation.physicsTime = 0; simulation.tick = 0; simulation.events = [];
  Object.assign(simulation.ball, { position: { x: .35, y: 0 }, velocity: { x: .15, y: 0 }, height: 1.4, verticalVelocity: -1,
    ownerId: null, carry: null, control: null, excludedId: null });
  const eventIndex = api.emitSimulationEvent(simulation, { type: 'pass', teamId: player.teamId, fromId: 'home-CAM', toId: player.id,
    fromPos: { x: -10, y: 0 }, toPos: { ...player.position }, success: null });
  simulation.ball.flight = { eventIndex, teamId: player.teamId, fromId: 'home-CAM', toId: player.id, fromPos: { x: -10, y: 0 }, target: { ...player.position }, launchTick: 0 };
  let prepared = false;
  for (let tick = 0; tick < 15 && !simulation.events.some(e => e.type === 'firstTouch'); tick++) {
    const frame = game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(simulation) }, { immediate: true }); scene.actors.apply(frame);
    const actor = scene.runtime.players.find(p => p.id === player.id);
    if (actor.bones.RightToeBase.getWorldPosition(new scene.THREE.Vector3()).y > .3) prepared = true;
    api.stepSimulation(simulation);
  }
  assert.equal(prepared, true, 'the boot prepares before the firstTouch event');
  const contact = simulation.events.find(e => e.type === 'firstTouch'); assert.ok(contact); assert.equal(contact.style, 'trap');
  assert.ok(contact.height >= .35 && contact.height <= .75);
});

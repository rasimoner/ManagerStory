const test = require('node:test');
const assert = require('node:assert/strict');
const { labFixture, plain } = require('./support/lab.cjs');
const { loadGame } = require('./support/game.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');

function noLookFixture() {
  const { api, input } = labFixture({ seed: 73 });
  input.match = false; input.durationSeconds = 420;
  const simulation = api.createSimulation(input), owner = simulation.teams[0].players.at(-1);
  const receiver = simulation.teams[0].players.find(player => player.slot === 'CAM'), decoy = simulation.teams[0].players.find(player => player.slot === 'RW');
  for (const team of simulation.teams) for (const player of team.players) { player.position = { x: -40, y: 25 }; player.target = { ...player.position }; }
  owner.position = { x: 20, y: -5 }; receiver.position = { x: 31, y: 5 }; decoy.position = { x: 34, y: -14 };
  owner.heading = Math.atan2(10, 11);
  Object.assign(owner.attributes, { passing: 100, technique: 90, vision: 95 });
  simulation.teams[1].players[4].position = { x: 24, y: -4 };
  api.placeSimulationBall(simulation, { teamId: owner.teamId, ownerId: owner.id, position: owner.position });
  const option = { toId: receiver.id, target: { ...receiver.position }, lofted: false };
  return { api, simulation, owner, receiver, decoy, option };
}

test('a no-look pass names a different real visible teammate as the gaze target', () => {
  const { api, simulation, owner, decoy, option } = noLookFixture();
  api.releaseSimulationPass(simulation, owner, option);
  const pass = simulation.events.find(event => event.type === 'pass');
  assert.equal(pass.style, 'nolook'); assert.equal(pass.gazeTargetId, decoy.id);
  assert.deepEqual(plain(pass.gazeTarget), decoy.position);
  assert.equal(pass.success, null, 'the deception does not decide the pass outcome');
});

test('ability, actual pressure and a real alternative target are required for no-look selection', () => {
  for (const reason of ['technique', 'pressure', 'alternative']) {
    const fixture = noLookFixture(), { api, simulation, owner, decoy, option } = fixture;
    if (reason === 'technique') owner.attributes.technique = 25;
    if (reason === 'pressure') simulation.teams[1].players[4].position = { x: 20.5, y: -5 };
    if (reason === 'alternative') decoy.position = { x: -40, y: 25 };
    api.releaseSimulationPass(simulation, owner, option);
    assert.notEqual(simulation.events.find(event => event.type === 'pass').style, 'nolook');
  }
});

test('no-look adds no result dice and preserves the ordinary pass trajectory and RNG', () => {
  const first = noLookFixture(), second = noLookFixture();
  second.simulation.clock.pauseHalfPreparation = false;
  first.api.releaseSimulationPass(first.simulation, first.owner, first.option);
  second.api.releaseSimulationPass(second.simulation, second.owner, second.option);
  assert.deepEqual(plain(first.simulation.ball.velocity), plain(second.simulation.ball.velocity));
  assert.equal(first.simulation.ball.verticalVelocity, second.simulation.ball.verticalVelocity);
  assert.equal(first.simulation.rngState, second.simulation.rngState);
});

test('the old no-look pose turns the actual head toward the recorded decoy while the boot plays the real pass', async () => {
  const { api, simulation, owner, option } = noLookFixture(), game = loadGame({ quiet: true }), scene = await sceneFixture();
  api.releaseSimulationPass(simulation, owner, option);
  const before = plain(api.snapshotSimulation(simulation));
  const frame = game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(simulation) }, { immediate: true });
  scene.actors.apply(frame);
  const actor = scene.runtime.players.find(actor => actor.id === owner.id);
  assert.equal(actor.act?.name, 'nolook');
  const head = actor.bones.Head, gaze = simulation.events.find(event => event.type === 'pass').gazeTarget;
  const actual = head.getWorldDirection(new scene.THREE.Vector3()).setY(0).normalize();
  const headPosition = head.getWorldPosition(new scene.THREE.Vector3());
  const expected = new scene.THREE.Vector3(gaze.x - headPosition.x, 0, gaze.y - headPosition.z).normalize();
  assert.ok(actual.dot(expected) > .98, 'the head looks at the actual alternative player');
  assert.deepEqual(plain(api.snapshotSimulation(simulation)), before);
});

module.exports = { noLookFixture };

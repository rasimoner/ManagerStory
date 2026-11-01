const test = require('node:test');
const assert = require('node:assert/strict');
const { plain } = require('../support/lab.cjs');
const { aerialFixture } = require('../support/aerial.cjs');
const { loadGame } = require('../support/game.cjs');
const { sceneFixture } = require('../support/simulation-scene.cjs');

test('an unpressured backward-facing player can strike an overhead ball with a bicycle kick', () => {
  const { api, simulation } = aerialFixture({ height: 1.6, bicycle: true });
  api.stepSimulation(simulation);
  assert.ok(simulation.events.some(event => event.type === 'shot' && event.style === 'bicycle'));
  assert.equal(simulation.ball.ownerId, null);
  assert.ok(simulation.ball.height > 1);
});

test('the overhead pose lifts, makes a real boot contact, lands and returns without changing its root or football', async () => {
  const { api, simulation, player } = aerialFixture({ bicycle: true }), game = loadGame({ quiet: true }), scene = await sceneFixture();
  api.stepSimulation(simulation);
  const before = plain(api.snapshotSimulation(simulation));
  const frame = game.api.captureSimulationFrame(simulation);
  scene.actors.apply(game.api.sampleSimulationScene({ frame }, { immediate: true }));
  const actor = scene.runtime.players.find(actor => actor.id === player.id);
  assert.equal(actor.act?.name, 'bicycle');
  assert.ok(actor.model.position.y > .1, 'the overhead action must leave the ground');
  const contact = simulation.events.find(event => event.type === 'aerialContact');
  const boot = actor.bones.RightToeBase.getWorldPosition(new scene.THREE.Vector3());
  const target = new scene.THREE.Vector3(contact.fromPos.x, contact.height + .11, contact.fromPos.y);
  assert.ok(boot.distanceTo(target) < .3, `overhead boot must meet the actual contact (${boot.distanceTo(target)})`);
  for (const seconds of [.4, .8, 1.2, 1.7]) {
    const sample = game.api.sampleSimulationScene({ frame }, { immediate: true });
    sample.physicsTime += seconds;
    scene.actors.apply(sample);
    assert.equal(actor.pos.x, player.position.x);
    assert.equal(actor.pos.z, player.position.y);
  }
  assert.equal(actor.flip, null);
  assert.deepEqual(plain(api.snapshotSimulation(simulation)), before);
});

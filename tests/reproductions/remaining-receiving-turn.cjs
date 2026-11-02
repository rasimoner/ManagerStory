const test = require('node:test');
const assert = require('node:assert/strict');
const { plain } = require('../support/lab.cjs');
const { sceneFixture } = require('../support/simulation-scene.cjs');
const { loadGame } = require('../support/game.cjs');

const { receivingFixture } = require('./receiving-turn-fixture.cjs');

for (const direction of [-1, 1]) test(`Bergkamp receiving sends the real ball and player past opposite sides, direction ${direction}`, () => {
  const { api, simulation } = receivingFixture(direction);
  for (let tick = 0; tick < 45 && !simulation.events.some(e => e.type === 'skill' && e.kind === 'pirouette' && !e.observed); tick++) api.stepSimulation(simulation);
  assert.ok(simulation.events.some(e => e.type === 'firstTouch' && e.style === 'pirouette'));
  assert.ok(simulation.events.some(e => e.type === 'skill' && e.kind === 'pirouette' && !e.observed), 'a normal turn or planned exit is not the opposite-side sequence');
});

test('the receiving contact uses the actual old first-touch boot and continuous ball path', async () => {
  const { api, simulation, player } = receivingFixture(), scene = await sceneFixture(), game = loadGame({ quiet: true });
  const previous = game.api.captureSimulationFrame(simulation); api.stepSimulation(simulation);
  const contact = simulation.events.find(e => e.type === 'firstTouch'); assert.equal(contact.style, 'pirouette');
  const current = game.api.captureSimulationFrame(simulation), before = plain(api.snapshotSimulation(simulation));
  const frame = game.api.sampleSimulationScene({ previousFrame: previous, frame: current, accumulatorSeconds: contact.time }, {});
  scene.actors.apply(frame);
  const actor = scene.runtime.players.find(p => p.id === player.id), side = simulation.ball.carry.skill.side < 0 ? 'Right' : 'Left';
  const boot = actor.bones[`${side}ToeBase`].getWorldPosition(new scene.THREE.Vector3());
  const ball = new scene.THREE.Vector3(contact.fromPos.x, contact.height + .11, contact.fromPos.y);
  assert.ok(boot.distanceTo(ball) < .3, `first-touch boot gap ${boot.distanceTo(ball)}`);
  assert.ok(new scene.THREE.Vector3().copy(frame.ball.position).distanceTo(ball) < .001);
  assert.deepEqual(plain(api.snapshotSimulation(simulation)), before);
  const restored = api.restoreSimulation(JSON.parse(JSON.stringify(before)));
  for (let tick = 0; tick < 40; tick++) { api.stepSimulation(simulation); api.stepSimulation(restored); }
  assert.deepEqual(plain(api.readSimulation(simulation)), plain(api.readSimulation(restored)));
});

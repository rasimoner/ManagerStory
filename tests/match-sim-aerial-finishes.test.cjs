const test = require('node:test');
const assert = require('node:assert/strict');
const { plain } = require('./support/lab.cjs');
const { loadGame } = require('./support/game.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');

const { aerialFixture } = require('./support/aerial.cjs');

for (const direction of [-1, 1]) {
  test(`head contact redirects a real high cross into an unowned shot, direction ${direction}`, () => {
    const { api, simulation } = aerialFixture({ direction });
    api.stepSimulation(simulation);
    const contact = simulation.events.find(event => event.type === 'aerialContact');
    assert.equal(contact?.kind, 'header'); assert.equal(contact.result, 'shot');
    assert.ok(simulation.events.some(event => event.type === 'shot' && event.style === 'header'));
    assert.equal(simulation.ball.ownerId, null);
    assert.ok(simulation.ball.height > 1, 'a header is not head control followed by a grounded shot');
    assert.ok(simulation.ball.velocity.x * direction > 0);
  });

  test(`a defensive header clears a dangerous cross away from its own goal, direction ${direction}`, () => {
    const { api, simulation } = aerialFixture({ direction, defending: true });
    api.stepSimulation(simulation);
    const contact = simulation.events.find(event => event.type === 'aerialContact');
    assert.equal(contact?.kind, 'header'); assert.equal(contact.result, 'clearance');
    assert.ok(simulation.ball.velocity.x * direction < 0);
    assert.equal(simulation.events.some(event => event.type === 'shot'), false);
    assert.equal(simulation.ball.ownerId, null);
  });
}

test('away from shooting range a head pass can find a physically reachable teammate', () => {
  const { api, simulation } = aerialFixture({ x: 8 });
  const mate = simulation.teams[0].players.find(player => player.slot === 'CAM');
  mate.position = { x: 20, y: 5 };
  api.stepSimulation(simulation);
  const contact = simulation.events.find(event => event.type === 'aerialContact');
  assert.equal(contact?.kind, 'header'); assert.equal(contact.result, 'pass');
  assert.ok(simulation.events.some(event => event.type === 'pass' && event.style === 'header' && event.toId === mate.id));
  assert.equal(simulation.ball.ownerId, null);
  assert.ok(simulation.ball.height > 1);
});

test('a technically capable player volleys a mid-height cross without erasing incoming height', () => {
  const { api, simulation } = aerialFixture({ height: .65 });
  api.stepSimulation(simulation);
  assert.ok(simulation.events.some(event => event.type === 'shot' && event.style === 'volley'));
  assert.ok(simulation.ball.height > .3);
});



test('pressure, wrong height or insufficient technique prevents an invented overhead finish', () => {
  for (const variant of ['pressure', 'height', 'technique']) {
    const { api, simulation, player } = aerialFixture({ height: variant === 'height' ? .2 : 1.6, bicycle: true });
    if (variant === 'pressure') simulation.teams[1].players[3].position = { x: player.position.x + 1, y: player.position.y };
    if (variant === 'technique') player.attributes.technique = 25;
    api.stepSimulation(simulation);
    assert.equal(simulation.events.some(event => event.type === 'shot' && event.style === 'bicycle'), false);
  }
});

test('saving before aerial contact preserves every event, physical continuation and RNG', () => {
  const { api, simulation } = aerialFixture();
  const restored = api.restoreSimulation(JSON.parse(JSON.stringify(api.snapshotSimulation(simulation))));
  for (let tick = 0; tick < 30; tick++) { api.stepSimulation(simulation); api.stepSimulation(restored); }
  assert.deepEqual(plain(api.readSimulation(restored)), plain(api.readSimulation(simulation)));
});

test('a high ball outside real horizontal reach does not become an aerial contact', () => {
  const { api, simulation, player } = aerialFixture();
  simulation.ball.position.y = player.position.y + 1;
  simulation.ball.velocity = { x: 0, y: 0 };
  api.stepSimulation(simulation);
  assert.equal(simulation.events.some(event => event.type === 'aerialContact'), false);
});

test('a real header uses the old header pose and the sampled ball passes through its contact point', async () => {
  const { api, simulation, player } = aerialFixture(), game = loadGame({ quiet: true }), scene = await sceneFixture();
  const previous = game.api.captureSimulationFrame(simulation);
  api.stepSimulation(simulation);
  const frame = game.api.captureSimulationFrame(simulation);
  const contact = simulation.events.find(event => event.type === 'aerialContact');
  assert.ok(contact);
  const sample = game.api.sampleSimulationScene({ previousFrame: previous, frame }, { immediate: true });
  scene.actors.apply(sample);
  const actor = scene.runtime.players.find(actor => actor.id === player.id);
  assert.equal((actor.act ?? actor.motion)?.name, 'header');
  assert.equal(actor.pos.x, player.position.x);
  assert.equal(actor.pos.z, player.position.y);
});

test('fractional aerial contact is retained in the interpolated incoming and outgoing ball path', () => {
  const { api, simulation } = aerialFixture(), game = loadGame({ quiet: true });
  simulation.ball.position.x = 40;
  simulation.ball.velocity.x = 20;
  const previousFrame = game.api.captureSimulationFrame(simulation);
  api.stepSimulation(simulation);
  const frame = game.api.captureSimulationFrame(simulation), contact = simulation.events.find(event => event.type === 'aerialContact');
  assert.ok(contact && contact.time > 0 && contact.time < .1);
  const sampled = game.api.sampleSimulationScene({ previousFrame, frame, accumulatorSeconds: contact.time });
  assert.ok(Math.abs(sampled.ball.position.x - contact.fromPos.x) < 1e-8);
  assert.ok(Math.abs(sampled.ball.position.y - contact.height - .11) < 1e-8);
});



const test = require('node:test');
const assert = require('node:assert/strict');
const { skillFixture } = require('./support/ground-skills.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');
const { loadGame } = require('./support/game.cjs');
const { plain } = require('./support/lab.cjs');

function flairFixture(direction = 1) {
  const f = skillFixture(direction), receiver = f.simulation.teams[0].players.find(p => p.slot === 'CAM');
  receiver.position = { x: 44 * direction, y: 1 }; receiver.target = { ...receiver.position };
  f.owner.attributes.passing = 95;
  f.api.requestSimulationPass(f.simulation, { toId: receiver.id, target: receiver.position });
  return { ...f, receiver };
}

for (const direction of [-1, 1]) test(`stepover pass makes its actual circle before a normal uncertain pass, direction ${direction}`, async () => {
  const { api, simulation, owner } = flairFixture(direction), scene = await sceneFixture(), game = loadGame({ quiet: true }), boots = [];
  for (let tick = 0; tick < 60 && !simulation.events.some(e => e.type === 'pass'); tick++) {
    api.stepSimulation(simulation);
    const frame = game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(simulation) }, { immediate: true });
    const before = plain(api.snapshotSimulation(simulation)); scene.actors.apply(frame);
    const actor = scene.runtime.players.find(p => p.id === owner.id), boot = actor.bones.RightToeBase.getWorldPosition(new scene.THREE.Vector3());
    if (simulation.passing.technique?.kind === 'flairpass') boots.push({ x: boot.x - frame.ball.position.x, y: boot.y, z: boot.z - frame.ball.position.z });
    assert.deepEqual(plain(api.snapshotSimulation(simulation)), before);
  }
  const pass = simulation.events.find(e => e.type === 'pass');
  assert.ok(pass); assert.equal(pass.style, 'flairpass'); assert.equal(pass.success, null);
  assert.ok(boots.length >= 5 && Math.max(...boots.map(p => p.y)) > .2, 'the real boot lifts through the circle before the release');
  assert.ok(Math.max(...boots.map(p => p.z)) - Math.min(...boots.map(p => p.z)) > .2);
});

test('stepover pass can be lost during its setup and a mid-circle save continues exactly', () => {
  const { api, simulation } = flairFixture(); api.stepSimulation(simulation);
  const restored = api.restoreSimulation(JSON.parse(JSON.stringify(api.snapshotSimulation(simulation))));
  for (let tick = 0; tick < 60; tick++) { api.stepSimulation(simulation); api.stepSimulation(restored); }
  assert.deepEqual(plain(api.readSimulation(restored)), plain(api.readSimulation(simulation)));
  const contested = flairFixture(); contested.defender.position = { ...contested.simulation.ball.position }; contested.defender.duel.nextTackleTick = 0;
  for (let tick = 0; tick < 10; tick++) contested.api.stepSimulation(contested.simulation);
  assert.ok(contested.simulation.ball.teamId !== contested.owner.teamId || !contested.simulation.events.some(e => e.type === 'pass' && e.style === 'flairpass'));
});

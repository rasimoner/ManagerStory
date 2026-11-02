const test = require('node:test');
const assert = require('node:assert/strict');
const { plain } = require('./support/lab.cjs');
const { skillFixture } = require('./support/ground-skills.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');
const { loadGame } = require('./support/game.cjs');

for (const kind of ['sombrero']) for (const direction of [-1, 1]) {
  test(`${kind} makes a distinct physical loft and permits a real contested continuation, direction ${direction}`, () => {
    const { api, simulation, owner, defender } = skillFixture(direction);
    assert.equal(api.beginSimulationAirSkill(simulation, owner, { kind, defenderId: defender.id }), true);
    const defenderOrigin = { ...defender.position }, touches = [];
    let peak = 0, crossed = false;
    for (let tick = 0; tick < 50; tick++) {
      const previous = simulation.ball.carry?.touchTick;
      api.stepSimulation(simulation);
      const ball = simulation.ball;
      peak = Math.max(peak, ball.height);
      if (ball.carry?.touchTick != null && ball.carry.touchTick !== previous) touches.push({ height: ball.height, position: { ...ball.position }, verticalVelocity: ball.verticalVelocity });
      if ((ball.position.x - defenderOrigin.x) * direction >= 0 && ball.height > 1.8) crossed = true;
    }
    const event = simulation.events.find(event => event.type === 'skill' && event.kind === kind && !event.observed);
    assert.ok(event, 'a named aerial move needs its specific actual touches');
    assert.ok(peak > 1.8 && crossed, 'the real ball must clear the actual defender height');
  });
}

test('saving in an aerial trick preserves the actual height, next touch, contest and RNG', () => {
  const { api, simulation, owner, defender } = skillFixture();
  api.beginSimulationAirSkill(simulation, owner, { kind: 'sombrero', defenderId: defender.id });
  for (let tick = 0; tick < 3; tick++) api.stepSimulation(simulation);
  const restored = api.restoreSimulation(JSON.parse(JSON.stringify(api.snapshotSimulation(simulation))));
  for (let tick = 0; tick < 50; tick++) { api.stepSimulation(simulation); api.stepSimulation(restored); }
  assert.deepEqual(plain(api.readSimulation(restored)), plain(api.readSimulation(simulation)));
});

test('the old sombrero scoop boot meets the actual launch with an unchanged root and checkpoint', async () => {
  const { api, simulation, owner, defender } = skillFixture(), scene = await sceneFixture(), game = loadGame({ quiet: true });
  api.beginSimulationAirSkill(simulation, owner, { kind: 'sombrero', defenderId: defender.id });
  for (let tick = 0; tick < 2; tick++) api.stepSimulation(simulation);
  const before = plain(api.snapshotSimulation(simulation));
  const frame = game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(simulation) }, { immediate: true });
  scene.actors.apply(frame);
  const actor = scene.runtime.players.find(actor => actor.id === owner.id), ball = new scene.THREE.Vector3().copy(frame.ball.position);
  const gap = Math.min(...['Left', 'Right'].map(side => actor.bones[`${side}ToeBase`].getWorldPosition(new scene.THREE.Vector3()).distanceTo(ball)));
  assert.ok(gap < .3, `sombrero must launch from a real boot (${gap})`);
  assert.equal(actor.pos.x, owner.position.x); assert.equal(actor.pos.z, owner.position.y);
  assert.deepEqual(plain(api.snapshotSimulation(simulation)), before);
});

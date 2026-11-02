const test = require('node:test');
const assert = require('node:assert/strict');
const { plain } = require('./support/lab.cjs');
const { skillFixture } = require('./support/ground-skills.cjs');
const { loadGame } = require('./support/game.cjs');
const { sceneFixture } = require('./support/simulation-scene.cjs');

for (const kind of ['stepover', 'elastico', 'cruyff', 'croqueta', 'roulette', 'dragBack']) {
  test(`${kind} uses real boots at each specific touch without moving the core root or ball`, async () => {
    const { api, simulation, owner, defender } = skillFixture(), game = loadGame({ quiet: true }), scene = await sceneFixture();
    api.beginSimulationGroundSkill(simulation, owner, { kind, defenderId: defender.id });
    let contacts = 0;
    const contactFeet = [];
    for (let tick = 0; tick < 24; tick++) {
      const beforeTick = simulation.ball.carry?.touchTick;
      api.stepSimulation(simulation);
      const carry = simulation.ball.carry;
      if (!carry?.skill || carry.touchTick == null || carry.touchTick === beforeTick) continue;
      const before = plain(api.snapshotSimulation(simulation));
      const frame = game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(simulation) }, { immediate: true });
      scene.actors.apply(frame);
      const actor = scene.runtime.players.find(actor => actor.id === owner.id), ball = new scene.THREE.Vector3().copy(frame.ball.position);
      const gaps = ['Left', 'Right'].map(side => actor.bones[`${side}ToeBase`].getWorldPosition(new scene.THREE.Vector3()).distanceTo(ball));
      verifyPhysicalPose({ kind, gaps, actor, owner }, { api, simulation, before });
      contactFeet.push(gaps[0] < gaps[1] ? 'Left' : 'Right');
      contacts++;
    }
    assert.ok(contacts > 0);
    if (kind === 'elastico') assert.equal(contactFeet[0], contactFeet[1], 'outside and inside are played by the same foot');
    if (kind === 'croqueta') assert.notEqual(contactFeet[0], contactFeet[1], 'the ball transfers between the feet');
  });
}

function verifyPhysicalPose({ kind, gaps, actor, owner }, { api, simulation, before }) {
  assert.ok(Math.min(...gaps) < .3, `${kind} has a real boot contact (${Math.min(...gaps)})`);
  assert.equal(actor.pos.x, owner.position.x); assert.equal(actor.pos.z, owner.position.y);
  assert.deepEqual(plain(api.snapshotSimulation(simulation)), before);
}

test('stepover circles around the ball before its first release', async () => {
  const { api, simulation, owner, defender } = skillFixture(), game = loadGame({ quiet: true }), scene = await sceneFixture();
  api.beginSimulationGroundSkill(simulation, owner, { kind: 'stepover', defenderId: defender.id });
  const positions = [];
  for (let tick = 0; tick < 6; tick++) {
    api.stepSimulation(simulation);
    const frame = game.api.sampleSimulationScene({ frame: game.api.captureSimulationFrame(simulation) }, { immediate: true });
    scene.actors.apply(frame);
    const actor = scene.runtime.players.find(actor => actor.id === owner.id);
    positions.push(actor.bones.LeftToeBase.getWorldPosition(new scene.THREE.Vector3()));
    assert.equal(simulation.ball.carry.touchTick, null, 'circling the ball is not a kick');
  }
  assert.ok(Math.max(...positions.map(point => point.y)) > .15, 'the circling boot must lift');
  assert.ok(positions[0].distanceTo(positions.at(-1)) > .15, 'the boot must trace a distinct circle path');
});
